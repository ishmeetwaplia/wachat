// server/services/whatsappWebhookService.js
const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Conversation = require("../models/ConversationSchema"); // Corrected model import
const Project = require("../models/project");
const flowExecutionService = require("./flowExecutionService"); // Import flow execution service
const { statusCode, resMessage } = require('../config/constants');
// Removed unused imports: Businessprofile, Flow, sendWhatsAppMessage, traverseFlow, sendWhatsAppMessages

/**
 * Handles incoming WhatsApp webhook payloads for message status updates and inbound messages.
 * This is the main entry point for Meta's webhooks.
 * @param {Object} req - The request object from Express (contains params, body, io instance).
 * @returns {Object} Success status and message.
 */
exports.handleWebhookPayload = async (req) => {
    const io = req.app.get('io'); // Get Socket.IO instance

    // 1. Webhook Verification Request (GET)
    if (req.method === 'GET') {
        const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // Use META_VERIFY_TOKEN for consistency
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log("Webhook GET request received for verification.");
        console.log("Mode:", mode, "Token:", token ? '[REDACTED]' : 'N/A', "Challenge:", challenge); // Mask token in logs

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('WEBHOOK_VERIFIED: Successfully subscribed to webhook.');
                return { status: statusCode.OK, raw: true, body: challenge }; // Send raw challenge back
            } else {
                console.error('Webhook verification failed: Invalid verify token or mode.');
                return { status: statusCode.FORBIDDEN, success: false, message: resMessage.Webhook_verification_failed || "Webhook verification failed." }; // Use a constant if available
            }
        }
        console.warn("Invalid verification request: Missing mode or token in query parameters.");
        return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid verification request." };
    }

    // 2. Incoming Webhook Event (POST)
    const payload = req.body;
    console.log("--- Incoming WhatsApp Webhook POST Payload ---");
    console.log(JSON.stringify(payload, null, 2)); // Log the entire payload for inspection
    console.log("----------------------------------------------");

    try {
        if (!payload || !payload.object || payload.object !== 'whatsapp_business_account') {
            console.warn("Webhook payload not for 'whatsapp_business_account' or invalid object type. Payload:", JSON.stringify(payload));
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid webhook object type." };
        }

        for (const entry of payload.entry) {
            const metaPhoneNumberID = entry.changes?.[0]?.value?.metadata?.phone_number_id;

            if (!metaPhoneNumberID) {
                console.warn(`[Webhook] Could not extract Meta Phone Number ID from entry. Skipping entry. Entry: ${JSON.stringify(entry)}`);
                continue;
            }

            console.log(`[Webhook] Processing events for Meta Phone Number ID: ${metaPhoneNumberID}`);

            for (const change of entry.changes) {
                if (change.field === 'messages') {
                    const value = change.value;

                    // Message Status Updates (for outbound messages sent by us)
                    if (value.statuses) {
                        for (const statusUpdate of value.statuses) {
                            const metaMessageId = statusUpdate.id;
                            const newStatus = statusUpdate.status;
                            const timestamp = new Date(parseInt(statusUpdate.timestamp) * 1000);

                            console.log(`[Webhook Status Update] Meta Message ID: ${metaMessageId}, New Status: ${newStatus}, Time: ${timestamp.toISOString()}`);

                            const messageDoc = await Message.findOne({ metaMessageId: metaMessageId, metaPhoneNumberID: metaPhoneNumberID });

                            if (messageDoc) {
                                messageDoc.status = newStatus;
                                messageDoc.updatedAt = new Date();
                                messageDoc.sentAt = timestamp;
                                if (statusUpdate.errors && statusUpdate.errors.length > 0) {
                                    messageDoc.errorDetails = statusUpdate.errors;
                                    console.error(`[Webhook Status Update Error] Details for ${metaMessageId}:`, JSON.stringify(statusUpdate.errors));
                                }
                                await messageDoc.save();
                                console.log(`[Webhook Status Update] Message DB ID ${messageDoc._id} status updated to ${newStatus}.`);

                                if (io) {
                                    io.to(messageDoc.userId.toString()).emit('messageStatusUpdate', {
                                        messageDbId: messageDoc._id,
                                        metaMessageId,
                                        newStatus,
                                        to: messageDoc.to,
                                        projectId: messageDoc.projectId,
                                        sentAt: messageDoc.sentAt,
                                        type: messageDoc.type,
                                        conversationId: messageDoc.conversationId
                                    });
                                    if (messageDoc.conversationId) {
                                        io.to(messageDoc.conversationId.toString()).emit('messageStatusUpdate', {
                                            messageDbId: messageDoc._id,
                                            metaMessageId,
                                            newStatus,
                                            to: messageDoc.to,
                                            projectId: messageDoc.projectId,
                                            sentAt: messageDoc.sentAt,
                                            type: messageDoc.type,
                                            conversationId: messageDoc.conversationId
                                        });
                                    }
                                }
                            } else {
                                console.warn(`[Webhook Status Update] Outbound Message with Meta ID ${metaMessageId} (Phone ID ${metaPhoneNumberID}) not found in DB for status update.`);
                            }
                        }
                    }

                    // Inbound Messages (messages coming from WhatsApp users to our WABA number)
                    if (value.messages) {
                        for (const inboundMessage of value.messages) {
                            const fromPhoneNumber = inboundMessage.from;
                            const whatsappId = inboundMessage.from;
                            const messageType = inboundMessage.type;
                            const messageContent = inboundMessage[messageType];
                            const metaMessageId = inboundMessage.id;
                            const timestamp = new Date(parseInt(inboundMessage.timestamp) * 1000);
                            const profileName = inboundMessage.contacts?.[0]?.profile?.name || fromPhoneNumber;

                            console.log(`\n--- Processing Inbound Message ---`);
                            console.log(`From: ${fromPhoneNumber}`);
                            console.log(`Meta Phone Number ID (Our Number): ${metaPhoneNumberID}`);
                            console.log(`Type: ${messageType}`);
                            console.log(`Meta Message ID: ${metaMessageId}`);
                            console.log(`Content: ${JSON.stringify(messageContent)}`);
                            console.log(`Timestamp: ${timestamp.toISOString()}`);
                            console.log(`----------------------------------`);

                            // Populate businessProfileId to ensure metaAccessToken is available for flowExecutionService
                            const project = await Project.findOne({ metaPhoneNumberID: metaPhoneNumberID })
                                                         .populate('businessProfileId');

                            if (!project) {
                                console.warn(`[Inbound Message] No project found for Meta Phone Number ID: ${metaPhoneNumberID}. Cannot process inbound message.`);
                                continue;
                            }
                            console.log(`[Inbound Message] Found Project: ${project.name} (ID: ${project._id})`);

                            let contact = await Contact.findOne({
                                projectId: project._id,
                                userId: project.userId,
                                whatsappId: whatsappId
                            });

                            if (!contact) {
                                const parsedPhoneNumber = fromPhoneNumber.replace(/^\+/, '');
                                let defaultCountryCode = '';
                                let defaultMobileNumber = parsedPhoneNumber;
                                if (parsedPhoneNumber.length > 10) {
                                    defaultCountryCode = parsedPhoneNumber.substring(0, parsedPhoneNumber.length - 10);
                                    defaultMobileNumber = parsedPhoneNumber.substring(parsedPhoneNumber.length - 10);
                                }

                                console.log(`[Inbound Message] Creating new contact for ${fromPhoneNumber} (WhatsApp ID: ${whatsappId}) in project ${project._id}`);
                                contact = await Contact.create({
                                    tenantId: project.tenantId,
                                    userId: project.userId,
                                    projectId: project._id,
                                    name: profileName,
                                    countryCode: defaultCountryCode,
                                    mobileNumber: fromPhoneNumber,
                                    whatsappId: whatsappId,
                                    profileName: profileName
                                });
                                console.log(`[Inbound Message] New contact created: ${contact._id}`);
                            } else if (contact.profileName !== profileName || contact.mobileNumber !== fromPhoneNumber.replace(/^\+/, '')) {
                                console.log(`[Inbound Message] Updating existing contact ${contact._id}. Old Name: ${contact.profileName}, New Name: ${profileName}`);
                                contact.profileName = profileName;
                                contact.mobileNumber = fromPhoneNumber.replace(/^\+/, '');
                                await contact.save();
                            } else {
                                console.log(`[Inbound Message] Existing contact found: ${contact._id}`);
                            }

                            let conversation = await Conversation.findOne({
                                projectId: project._id,
                                contactId: contact._id,
                                metaPhoneNumberID: metaPhoneNumberID
                            });

                            if (!conversation) {
                                console.log(`[Inbound Message] Creating new conversation for project ${project._id} with contact ${contact._id} via phone ID ${metaPhoneNumberID}`);
                                conversation = await Conversation.create({
                                    tenantId: project.tenantId,
                                    userId: project.userId,
                                    projectId: project._id,
                                    contactId: contact._id,
                                    metaPhoneNumberID: metaPhoneNumberID,
                                    latestMessage: messageContent.body || messageType,
                                    latestMessageType: messageType,
                                    lastActivityAt: timestamp,
                                    unreadCount: 1,
                                    isActive: true
                                });
                                console.log(`[Inbound Message] New conversation created: ${conversation._id}`);
                            } else {
                                console.log(`[Inbound Message] Updating existing conversation: ${conversation._id}`);
                                conversation.latestMessage = messageContent.body || messageType;
                                conversation.latestMessageType = messageType;
                                conversation.lastActivityAt = timestamp;
                                conversation.unreadCount = (conversation.unreadCount || 0) + 1;
                                conversation.isActive = true;
                                await conversation.save();
                            }

                            const messageDoc = await Message.create({
                                tenantId: project.tenantId,
                                userId: project.userId,
                                projectId: project._id,
                                conversationId: conversation._id,
                                metaPhoneNumberID: metaPhoneNumberID,
                                from: fromPhoneNumber, // Sender's number
                                to: metaPhoneNumberID, // Our number
                                direction: 'inbound',
                                type: messageType,
                                message: inboundMessage, // Store full inbound message object
                                metaMessageId: metaMessageId,
                                status: 'received', // Initial status for inbound
                                sentAt: timestamp
                            });
                            console.log(`[Inbound Message] Inbound message saved to DB: ${messageDoc._id}`);

                            if (io) {
                                // Emit to the user/project owner for conversation list updates (left panel)
                                io.to(project.userId.toString()).emit('newInboundMessage', {
                                    message: messageDoc.toObject(),
                                    conversation: conversation.toObject(),
                                    contact: contact.toObject()
                                });
                                // Emit to the specific conversation room for active chat window updates (right panel)
                                io.to(conversation._id.toString()).emit('newChatMessage', {
                                    message: messageDoc.toObject(),
                                    contact: contact.toObject(),
                                    conversationId: conversation._id
                                });
                                console.log(`[Inbound Message] Emitted 'newInboundMessage' to user room '${project.userId}' and 'newChatMessage' to conversation room '${conversation._id}'`);
                            }

                            // --- Delegate to Flow Execution Service for Auto-Reply ---
                            let userInputText = '';
                            let interactiveResponseId = '';

                            if (messageType === 'text') {
                                userInputText = messageContent.body;
                            } else if (messageType === 'interactive') {
                                if (messageContent.type === 'button_reply') {
                                    userInputText = messageContent.button_reply.title; // Text of the button
                                    interactiveResponseId = messageContent.button_reply.id; // ID of the button (payload)
                                } else if (messageContent.type === 'list_reply') {
                                    userInputText = messageContent.list_reply.title;
                                    interactiveResponseId = messageContent.list_reply.id;
                                }
                            }
                            // Add other message types if they should trigger flows (e.g., image caption, location)

                            const parsedMessageForFlow = {
                                from: fromPhoneNumber,
                                whatsappPhoneNumberId: metaPhoneNumberID,
                                messageType: messageType,
                                userInput: userInputText,
                                interactiveResponseId: interactiveResponseId,
                                metaMessageId: metaMessageId,
                                timestamp: timestamp,
                                profileName: profileName,
                                originalMessageContent: inboundMessage // Pass the full Meta message object
                            };

                            console.log(`[Webhook] Passing message to flowExecutionService for auto-reply...`);
                            await flowExecutionService.handleIncomingMessageForFlow(parsedMessageForFlow, project, contact, conversation);
                            // The flowExecutionService will handle sending the auto-reply and updating ConversationSession
                        }
                    }
                }
            }
        }
        console.log("--- Webhook Payload Processing Complete ---");
        return { status: statusCode.OK, success: true, message: resMessage.Webhook_received_successfully };
    } catch (error) {
        console.error("--- Error processing webhook payload ---");
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
        return { status: statusCode.INTERNAL_SERVER_ERROR, success: false, message: error.message || resMessage.Server_error };
    }
};
