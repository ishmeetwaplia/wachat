// server/services/flowExecutionService.js
const ConversationSession = require('../models/ConversationSessionSchema');
const Flow = require('../models/Flow');
const Project = require('../models/Project');
const BusinessProfile = require('../models/BusinessProfile');
const Message = require('../models/Message'); // To save outbound messages from flow execution
const axios = require('axios');
const { statusCode, resMessage } = require('../config/constants');

// Helper to send WhatsApp messages (similar to messageService, but internal to flow execution)
const sendWhatsAppMessageInternal = async ({ to, type, message, phoneNumberId, accessToken, facebookUrl, graphVersion }) => {
    const url = `${facebookUrl}/${graphVersion}/${phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type
    };

    switch (type) {
        case 'text':
            payload.text = { body: message.body };
            break;
        case 'template':
            payload.template = {
                name: message.name,
                language: { code: message.language.code },
                components: message.components // Expecting Meta-formatted components
            };
            break;
        case 'image':
        case 'document':
        case 'video':
            payload[type] = {};
            if (message.id) payload[type].id = message.id; // Media handle from Meta
            if (message.link) payload[type].link = message.link; // Direct URL
            if (message.caption) payload[type].caption = message.caption;
            if (message.filename && type === 'document') payload.document.filename = message.filename;
            break;
        case 'interactive': // For buttons, lists
            payload.interactive = message.interactive;
            break;
        default:
            console.error("Unsupported message type for internal send:", type);
            return { success: false, error: "Unsupported message type." };
    }

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (err) {
        const error = err.response?.data || err.message;
        console.error('Internal WhatsApp Message Send Error:', JSON.stringify(error, null, 2));
        return { success: false, error };
    }
};

/**
 * Executes a single node in the flow and sends a WhatsApp message if applicable.
 * @param {Object} session - The current ConversationSession document.
 * @param {Object} flow - The Flow document containing nodes and edges.
 * @param {Object} node - The current node to execute.
 * @param {Object} metaCredentials - Meta API credentials.
 * @param {Object} parsedMessageData - The incoming message data (used for user input for conditionals/collect input).
 * @returns {Promise<Object>} The updated session or an error.
 */
const executeNode = async (session, flow, node, metaCredentials, parsedMessageData) => {
    const { whatsappContactId, whatsappPhoneNumberId, projectId, userId, tenantId } = session;
    const { accessToken, facebookUrl, graphVersion } = metaCredentials;
    const { userInput, interactiveResponseId } = parsedMessageData;

    let nextNodeId = null; // Default next node
    let messageSent = false;
    let botMessageContent = '';
    let updatedSessionData = {};

    try {
        switch (node.type) {
            case 'startNode':
                // For start node, it typically just points to the first actual action node.
                // It should have one outgoing edge from its default handle 'a'.
                const startEdge = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === 'a');
                if (startEdge) {
                    nextNodeId = startEdge.target;
                } else {
                    console.warn(`Start node ${node.id} has no outgoing edge from handle 'a'.`);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Flow ended unexpectedly after start.";
                }
                break;

            case 'sendTextNode':
                // Assuming frontend saves text content in node.data.messageContent
                const textMessage = { body: node.data.messageContent };
                const textSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'text',
                    message: textMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (textSendResult.success) {
                    messageSent = true;
                    botMessageContent = node.data.messageContent;
                    // Find the next edge from the standard output handle 'a'
                    const nextEdge = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === 'a');
                    if (nextEdge) nextNodeId = nextEdge.target;
                } else {
                    console.error("Failed to send text message:", textSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send message.";
                }
                break;

            case 'sendMediaNode':
                const mediaMessage = {
                    id: node.data.mediaHandle,
                    caption: node.data.caption,
                    filename: node.data.fileName,
                };
                const mediaSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: node.data.mediaType,
                    message: mediaMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (mediaSendResult.success) {
                    messageSent = true;
                    botMessageContent = `Sent ${node.data.mediaType}.`;
                    const nextEdge = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === 'a');
                    if (nextEdge) nextNodeId = nextEdge.target;
                } else {
                    console.error(`Failed to send ${node.data.mediaType} message:`, mediaSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send media.";
                }
                break;

            case 'sendTemplateNode':
                const templateMessage = {
                    name: node.data.templateName,
                    language: { code: node.data.templateLanguage },
                    components: []
                };

                if (node.data.templateComponents && node.data.templateParameters) {
                    node.data.templateComponents.forEach(comp => {
                        const metaComp = { type: comp.type };
                        if (comp.type === 'BODY' && comp.variables) {
                            metaComp.parameters = node.data.templateParameters
                                .filter(p => p.type === 'body' && comp.variables.includes(p.index))
                                .map(p => ({ type: 'text', text: p.text }));
                        }
                        templateMessage.components.push(metaComp);
                    });
                }
console.log(`[Flow Execution] Sending template message: ${templateMessage} with components:`, JSON.stringify(templateMessage, null, 2));
                const templateSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'template',
                    message: templateMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (templateSendResult.success) {
                    messageSent = true;
                    botMessageContent = `Sent template: ${node.data.templateName}.`;
                    const nextEdge = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === 'a');
                    if (nextEdge) nextNodeId = nextEdge.target;
                } else {
                    console.error("Failed to send template message:", templateSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send template.";
                }
                break;

            case 'sendButtonsNode':
                const interactiveMessage = {
                    type: 'button',
                    body: { text: node.data.messageContent || 'Please select an option:' },
                    action: {
                        buttons: node.data.buttons.map(btn => {
                            if (btn.type === 'quick_reply') {
                                return { type: 'reply', reply: { id: btn.id, title: btn.text } };
                            } else if (btn.type === 'url') {
                                return { type: 'url', url: btn.value, title: btn.text };
                            } else if (btn.type === 'phone_number') {
                                return { type: 'phone_number', phone_number: btn.value, title: btn.text };
                            }
                            return null;
                        }).filter(Boolean)
                    }
                };
                const buttonsSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'interactive',
                    message: { interactive: interactiveMessage },
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (buttonsSendResult.success) {
                    messageSent = true;
                    botMessageContent = `Sent interactive message with buttons.`;
                    updatedSessionData.status = 'awaiting_input'; // Wait for user button click
                    nextNodeId = node.id; // Stay on this node until a valid button response is received
                } else {
                    console.error("Failed to send buttons message:", buttonsSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send interactive message.";
                }
                break;

            case 'collectInputNode':
                // Check if all fields are collected
                const allFieldsCollected = node.data.fields.every(field => session.collectedData[field.id] !== undefined);

                if (!allFieldsCollected) {
                    const currentField = node.data.fields.find(field => session.collectedData[field.id] === undefined);
                    const promptMessage = { body: currentField.prompt };
                    const inputSendResult = await sendWhatsAppMessageInternal({
                        to: whatsappContactId,
                        type: 'text',
                        message: promptMessage,
                        phoneNumberId: whatsappPhoneNumberId,
                        accessToken,
                        facebookUrl,
                        graphVersion
                    });
                    if (inputSendResult.success) {
                        messageSent = true;
                        botMessageContent = currentField.prompt;
                        updatedSessionData.status = 'awaiting_input';
                        updatedSessionData.awaitingFieldId = currentField.id; // Store which field we are waiting for
                        nextNodeId = node.id; // Stay on this node
                    } else {
                        console.error("Failed to send input prompt:", inputSendResult.error);
                        updatedSessionData.status = 'ended';
                        botMessageContent = "Failed to prompt for input.";
                    }
                } else {
                    // All fields collected, send confirmation message
                    const confirmationMessage = { body: node.data.confirmationMessage || "Thank you for your information!" };
                    const confirmSendResult = await sendWhatsAppMessageInternal({
                        to: whatsappContactId,
                        type: 'text',
                        message: confirmationMessage,
                        phoneNumberId: whatsappPhoneNumberId,
                        accessToken,
                        facebookUrl,
                        graphVersion
                    });
                    if (confirmSendResult.success) {
                        messageSent = true;
                        botMessageContent = confirmationMessage.body;
                        const nextEdge = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === 'a');
                        if (nextEdge) nextNodeId = nextEdge.target;
                        else updatedSessionData.status = 'ended';
                    } else {
                        console.error("Failed to send confirmation message:", confirmSendResult.error);
                        updatedSessionData.status = 'ended';
                        botMessageContent = "Failed to send confirmation.";
                    }
                }
                break;

            case 'conditionalNode':
                let conditionMet = false;
                if (node.data.condition && userInput) {
                    try {
                        // DANGER: Using `eval` is for demonstration only.
                        // In a real app, implement a secure expression parser or a rule engine.
                        const evalContext = { user_input: userInput.toLowerCase(), collected_data: session.collectedData };
                        const conditionExpression = node.data.condition
                            .replace(/user_input/g, `evalContext.user_input`)
                            .replace(/collected_data\.(\w+)/g, `evalContext.collected_data.$1`);
                        conditionMet = eval(conditionExpression);
                    } catch (evalError) {
                        console.error("Error evaluating condition:", evalError);
                        conditionMet = false;
                    }
                }

                const conditionalEdge = flow.edges.find(edge =>
                    edge.source === node.id &&
                    ((conditionMet && edge.sourceHandle === 'true') || (!conditionMet && edge.sourceHandle === 'false'))
                );

                if (conditionalEdge) {
                    nextNodeId = conditionalEdge.target;
                } else {
                    console.warn(`Conditional node ${node.id} has no matching outgoing edge for condition ${conditionMet}.`);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Flow ended due to unhandled condition.";
                }
                break;

            case 'actionNode':
                if (node.data.actionType === 'handoff_to_agent') {
                    updatedSessionData.status = 'live_agent_handoff';
                    botMessageContent = node.data.messageContent || "Connecting you to a live agent.";
                    const handoffMessage = { body: botMessageContent };
                    await sendWhatsAppMessageInternal({
                        to: whatsappContactId,
                        type: 'text',
                        message: handoffMessage,
                        phoneNumberId: whatsappPhoneNumberId,
                        accessToken,
                        facebookUrl,
                        graphVersion
                    });
                    messageSent = true;
                } else if (node.data.actionType === 'return_to_main_menu') {
                    updatedSessionData.status = 'ended'; // End current session
                    botMessageContent = node.data.messageContent || "Returning to main menu.";
                    const returnMessage = { body: botMessageContent };
                    await sendWhatsAppMessageInternal({
                        to: whatsappContactId,
                        type: 'text',
                        message: returnMessage,
                        phoneNumberId: whatsappPhoneNumberId,
                        accessToken,
                        facebookUrl,
                        graphVersion
                    });
                    messageSent = true;
                }
                // Action nodes usually terminate the flow or redirect, so no nextNodeId is set here.
                break;

            case 'fallbackNode':
                botMessageContent = node.data.messageContent || "Sorry, I didn't understand that.";
                const fallbackMessage = { body: botMessageContent };
                await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'text',
                    message: fallbackMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                messageSent = true;
                updatedSessionData.status = 'ended'; // Fallback usually ends the current flow
                break;

            // Fallback for older/simpler node types like 'text' from your example flow
            case 'text': // Handle 'text' type from older flows/manual JSON
                console.warn(`[Flow Execution] Deprecated node type 'text' encountered. Please update your flows to use 'sendTextNode'.`);
                const legacyTextMessage = { body: node.data.message }; // Assuming 'message' field for old 'text' type
                const legacyTextSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'text',
                    message: legacyTextMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (legacyTextSendResult.success) {
                    messageSent = true;
                    botMessageContent = node.data.message;
                    // For older 'text' nodes, assume a single outgoing edge (handle 'reply' or 'a' or first available)
                    const nextEdge = flow.edges.find(edge =>
                        edge.source === node.id && (edge.sourceHandle === 'reply' || edge.sourceHandle === 'a' || !edge.sourceHandle)
                    );
                    if (nextEdge) nextNodeId = nextEdge.target;
                } else {
                    console.error("Failed to send legacy text message:", legacyTextSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send legacy message.";
                }
                break;

            // NEW: Fallback for older/simpler node type 'template'
            case 'template':
                console.warn(`[Flow Execution] Deprecated node type 'template' encountered. Please update your flows to use 'sendTemplateNode'.`);
                const legacyTemplateMessage = {
                    name: node.data.selectedTemplateName, // Assuming this field holds the template name
                    language: { code: node.data.templateLanguage }, // Assuming default 'en' for older templates
                    components: [] // You might need to infer/construct components if old flows don't store them explicitly
                };

                // If old template nodes have parameters, you'd need logic here to map them
                // For example, if node.data.parameters exists and is an array of { key: 'param1', value: 'value1' }
                // then you'd construct Meta's components array.
                // For now, assuming simple templates without dynamic parameters for this 'template' type.

                const legacyTemplateSendResult = await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'template',
                    message: legacyTemplateMessage,
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken,
                    facebookUrl,
                    graphVersion
                });
                if (legacyTemplateSendResult.success) {
                    messageSent = true;
                    botMessageContent = `Sent legacy template: ${node.data.selectedTemplateName}.`;
                    const nextEdge = flow.edges.find(edge =>
                        edge.source === node.id && (edge.sourceHandle === 'reply' || edge.sourceHandle === 'a' || !edge.sourceHandle)
                    );
                    if (nextEdge) nextNodeId = nextEdge.target;
                } else {
                    console.error("Failed to send legacy template message:", legacyTemplateSendResult.error);
                    updatedSessionData.status = 'ended';
                    botMessageContent = "Failed to send legacy template.";
                }
                break;

            default:
                console.warn(`Unknown node type encountered: ${node.type}`);
                updatedSessionData.status = 'ended';
                botMessageContent = "Flow encountered an unknown step.";
                break;
        }

        // Update session after node execution
        session.currentNodeId = nextNodeId;
        session.lastBotMessage = botMessageContent;
        session.lastActivityAt = new Date();
        Object.assign(session, updatedSessionData); // Apply status changes etc.
        await session.save();

        // Save outbound message to Message log
        if (messageSent) {
            await Message.create({
                to: whatsappContactId,
                type: node.type === 'sendButtonsNode' ? 'interactive' : node.type.replace('send', '').toLowerCase().replace('node', ''),
                message: { body: botMessageContent }, // Simplified message for log
                metaResponse: {}, // Placeholder, actual response could be logged from sendWhatsAppMessageInternal
                status: 'sent',
                userId,
                tenantId,
                projectId,
                metaPhoneNumberID: whatsappPhoneNumberId,
                direction: 'outbound',
                bulkSendJobId: null, // Not a bulk send
            });
        }

        return { success: true, session };

    } catch (error) {
        console.error(`Error executing node ${node.id} of type ${node.type}:`, error);
        session.status = 'ended'; // End session on critical error
        session.lastActivityAt = new Date();
        await session.save();
        return { success: false, error: error.message || "Error executing flow node." };
    }
};

/**
 * Main function to handle incoming WhatsApp messages for flow execution.
 * This function is called by the webhook service after initial message logging.
 * @param {Object} parsedMessageData - Parsed data from the incoming webhook message.
 * @param {string} parsedMessageData.from - User's WhatsApp ID.
 * @param {string} parsedMessageData.whatsappPhoneNumberId - Your WhatsApp Phone Number ID.
 * @param {string} parsedMessageData.messageType - 'text', 'interactive', etc.
 * @param {string} parsedMessageData.userInput - Text content of the message.
 * @param {string} parsedMessageData.interactiveResponseId - ID of button/list item clicked (if interactive).
 * @param {Object} project - The Project document associated with the incoming message's phone number (populated with businessProfileId).
 * @param {Object} contact - The Contact document associated with the sender.
 * @param {Object} conversation - The Conversation document associated with the message.
 * @returns {Object} Result of the processing.
 */
exports.handleIncomingMessageForFlow = async (parsedMessageData, project, contact, conversation) => {
    const { from: whatsappContactId, whatsappPhoneNumberId, userInput, interactiveResponseId } = parsedMessageData;
    const userId = project.userId;
    const tenantId = project.tenantId;
    const projectId = project._id;

    console.log(`[Flow Execution] Handling message from ${whatsappContactId} for project ${projectId}`);

    // 1. Get Meta API credentials from the Project's Business Profile
    const businessProfile = project.businessProfileId; // Project should already be populated
    if (!businessProfile || !businessProfile.metaAccessToken ) {
        console.error("Meta API credentials incomplete for project's business profile.");
        return { success: false, message: resMessage.Meta_API_credentials_not_configured };
    }
    const metaCredentials = {
        accessToken: businessProfile.metaAccessToken,
        facebookUrl: businessProfile.facebookUrl || 'https://graph.facebook.com', // Use default if not set
        graphVersion: businessProfile.graphVersion || 'v19.0', // Use default if not set
    };

    // 2. Find or Create Conversation Session
    let session = await ConversationSession.findOne({
        whatsappContactId: whatsappContactId,
        whatsappPhoneNumberId: whatsappPhoneNumberId,
        status: { $in: ['active', 'awaiting_input'] } // Find active or awaiting sessions
    });
    console.log(`[Flow Execution] Found session: ${session ? session._id : 'None'} for contact ${whatsappContactId}`);


    let activeFlow = null; // Will store the flow to be executed
    let initialNodeToExecute = null; // Will store the ID of the first node to execute

    if (!session) {
        // No active session, try to find a flow by trigger keyword
        const flowByTrigger = await Flow.findOne({
            projectId: projectId,
            tenantId,
            status: 'active',
            triggerKeyword: new RegExp(`^${userInput.trim()}$`, 'i') // Case-insensitive exact match
        });
        console.log(`[Flow Execution] Flow found by trigger keyword: ${flowByTrigger ? flowByTrigger.name : 'None'} for input "${userInput}"`);

        if (flowByTrigger) {
            activeFlow = flowByTrigger;
            initialNodeToExecute = activeFlow.nodes.find(n => n.type === 'startNode')?.id || activeFlow.nodes[0]?.id;

            // Start a new session with this flow
            session = await ConversationSession.create({
                whatsappContactId: whatsappContactId,
                whatsappPhoneNumberId: whatsappPhoneNumberId,
                projectId: projectId,
                userId,
                tenantId,
                currentFlowId: activeFlow._id,
                currentNodeId: initialNodeToExecute,
                lastUserMessage: userInput,
                status: 'active',
                collectedData: {} // Initialize collected data for new session
            });
            console.log(`[Flow Execution] New session started for ${whatsappContactId} with flow: ${activeFlow.name}, starting at node: ${initialNodeToExecute}`);
        } else {
            // No flow found by trigger, try to find a fallback flow
            const fallbackFlow = await Flow.findOne({
                projectId: projectId,
                tenantId,
                status: 'active',
                triggerKeyword: 'fallback' // Assuming a special 'fallback' keyword for a default error flow
            });

            if (fallbackFlow) {
                activeFlow = fallbackFlow;
                initialNodeToExecute = activeFlow.nodes.find(n => n.type === 'fallbackNode')?.id || activeFlow.nodes[0]?.id;

                session = await ConversationSession.create({
                    whatsappContactId: whatsappContactId,
                    whatsappPhoneNumberId: whatsappPhoneNumberId,
                    projectId: projectId,
                    userId,
                    tenantId,
                    currentFlowId: activeFlow._id,
                    currentNodeId: initialNodeToExecute,
                    lastUserMessage: userInput,
                    status: 'active',
                    collectedData: {}
                });
                console.log(`[Flow Execution] New session started for ${whatsappContactId} with fallback flow, starting at node: ${initialNodeToExecute}`);
            } else {
                console.log(`[Flow Execution] No active flow or fallback flow found for input: "${userInput}" from ${whatsappContactId}. Sending generic response.`);
                // Send a generic "I don't understand" message if no flow is found
                await sendWhatsAppMessageInternal({
                    to: whatsappContactId,
                    type: 'text',
                    message: { body: "Sorry, I didn't understand your message. Please try a different keyword or contact support." },
                    phoneNumberId: whatsappPhoneNumberId,
                    accessToken: metaCredentials.accessToken,
                    facebookUrl: metaCredentials.facebookUrl,
                    graphVersion: metaCredentials.graphVersion
                });
                return { success: true, message: resMessage.No_active_flow_found };
            }
        }
    } else {
        // Existing session found, retrieve the active flow
        activeFlow = await Flow.findById(session.currentFlowId);
        if (!activeFlow) {
            console.error(`[Flow Execution] Active flow ${session.currentFlowId} not found for existing session ${session._id}. Ending session.`);
            session.status = 'ended';
            await session.save();
            return { success: false, message: "Active flow for session not found." };
        }
        session.lastUserMessage = userInput;
        session.lastActivityAt = new Date();
        await session.save();
        console.log(`[Flow Execution] Continuing session for ${whatsappContactId}, current node: ${session.currentNodeId}`);
    }

    // 3. Execute the current node of the active flow (if one was found or created)
    if (session && activeFlow && session.currentNodeId) {
        let currentNode = activeFlow.nodes.find(n => n.id === session.currentNodeId);
        if (!currentNode) {
            console.error(`[Flow Execution] Current node ${session.currentNodeId} not found in flow ${activeFlow._id}. Ending session.`);
            session.status = 'ended';
            await session.save();
            return { success: false, message: "Current node not found in flow." };
        }

        // Handle 'awaiting_input' state
        if (session.status === 'awaiting_input') {
            const previousNode = activeFlow.nodes.find(n => n.id === session.currentNodeId);

            if (previousNode.type === 'sendButtonsNode') {
                const matchingButton = previousNode.data.buttons.find(btn =>
                    btn.id === interactiveResponseId
                );
                if (matchingButton) {
                    const nextEdge = activeFlow.edges.find(edge =>
                        edge.source === previousNode.id && edge.sourceHandle === matchingButton.id
                    );
                    if (nextEdge) {
                        session.currentNodeId = nextEdge.target;
                        session.status = 'active';
                        await session.save();
                        currentNode = activeFlow.nodes.find(n => n.id === session.currentNodeId);
                        if (!currentNode) {
                            console.error(`[Flow Execution] Next node ${session.currentNodeId} not found after button click. Ending session.`);
                            session.status = 'ended'; await session.save();
                            return { success: false, message: "Flow ended unexpectedly after button click." };
                        }
                    } else {
                        console.warn(`[Flow Execution] No edge found for button ${matchingButton.id} from node ${previousNode.id}. Re-sending previous node or fallback.`);
                        const fallbackNode = activeFlow.nodes.find(n => n.type === 'fallbackNode');
                        if (fallbackNode) {
                            return await executeNode(session, activeFlow, fallbackNode, metaCredentials, parsedMessageData);
                        } else {
                            return await executeNode(session, activeFlow, previousNode, metaCredentials, parsedMessageData);
                        }
                    }
                } else {
                    console.log(`[Flow Execution] User input "${userInput}" (ID: ${interactiveResponseId}) did not match any button for node ${previousNode.id}.`);
                    const fallbackNode = activeFlow.nodes.find(n => n.type === 'fallbackNode');
                    if (fallbackNode) {
                        return await executeNode(session, activeFlow, fallbackNode, metaCredentials, parsedMessageData);
                    } else {
                        return await executeNode(session, activeFlow, previousNode, metaCredentials, parsedMessageData);
                    }
                }
            } else if (previousNode.type === 'collectInputNode' && session.awaitingFieldId) {
                session.collectedData[session.awaitingFieldId] = userInput;
                session.awaitingFieldId = undefined;
                session.status = 'active';
                await session.save();
                currentNode = previousNode;
            }
        }

        // Execute the (new) current node
        return await executeNode(session, activeFlow, currentNode, metaCredentials, parsedMessageData);

    } else {
        // This block should ideally only be reached if no flow was found/created,
        // and no generic message was sent. It acts as a final catch-all.
        console.log("[Flow Execution] Final check: No active session or flow found to execute.");
        return { success: true, message: "Message processed, no flow executed." };
    }
};
