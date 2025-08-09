// server/services/webhookService.js
const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Conversation = require("../models/ConversationSchema");
const Project = require("../models/project");
const { statusCode, resMessage } = require('../config/constants');
const Businessprofile = require("../models/BusinessProfile");
const Flow = require("../models/Flow");
const { traverseFlow } = require('../functions/functions');
const {sendWhatsAppMessages} = require("../services/messageService");
const ConversationSession = require('../models/ConversationSessionSchema');
 
exports.handleWebhookPayload = async (req) => {
    const io = req.app.get('io');
    let businessProfileData;
 
    if (req.method === 'GET') {
        const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
 
        console.log("Webhook GET request received for verification.");
 
        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('WEBHOOK_VERIFIED: Successfully subscribed to webhook.');
                return { status: statusCode.OK, raw: true, body: challenge }; 
            } else {
                console.error('Webhook verification failed: Invalid verify token or mode.');
                return { status: statusCode.FORBIDDEN, success: false, message: resMessage.Webhook_verification_failed || "Webhook verification failed." }; // Use a constant if available
            }
        }
        console.warn("Invalid verification request: Missing mode or token in query parameters.");
        return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid verification request." };
    }
 
    const payload = req.body;
    console.log("=======Webhook data========", JSON.stringify(payload, null, 2));

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
            for (const change of entry.changes) {
                if (change.field === 'messages') {
                    const value = change.value;
 
                    if (value.statuses) {
                        for (const statusUpdate of value.statuses) {
                            const metaMessageId = statusUpdate.id;
                            const newStatus = statusUpdate.status;
                            const timestamp = new Date(parseInt(statusUpdate.timestamp) * 1000);
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
 
                    if (value.messages) {
                        for (const inboundMessage of value.messages) {
                            const fromPhoneNumber = inboundMessage.from;
                            const whatsappId = inboundMessage.from;
                            const messageType = inboundMessage.type;
                            const messageContent = inboundMessage[messageType];
                            const metaMessageId = inboundMessage.id;
                            const timestamp = new Date(parseInt(inboundMessage.timestamp) * 1000);
                            const profileName = inboundMessage.contacts?.[0]?.profile?.name || fromPhoneNumber;
                            const project = await Project.findOne({ metaPhoneNumberID: metaPhoneNumberID });
 
                            if (!project) {
                                console.warn(`[Inbound Message] No project found for Meta Phone Number ID: ${metaPhoneNumberID}. Cannot process inbound message.`);
                                continue;
                            }
                            businessProfileData = await Businessprofile.findById(project.businessProfileId);
 
                            const parsedPhoneNumber = fromPhoneNumber.replace(/^\+/, '');

                            let contact = await Contact.findOne({
                                tenantId: project.tenantId,
                                projectId: project._id,
                                mobileNumber: parsedPhoneNumber
                            });

                            if (!contact) {
                                let defaultCountryCode = '';
                                let defaultMobileNumber = parsedPhoneNumber;

                                if (parsedPhoneNumber.length > 10) {
                                    defaultCountryCode = parsedPhoneNumber.substring(0, parsedPhoneNumber.length - 10);
                                    defaultMobileNumber = parsedPhoneNumber.substring(parsedPhoneNumber.length - 10);
                                }

                                contact = await Contact.create({
                                    tenantId: project.tenantId,
                                    userId: project.userId,
                                    projectId: project._id,
                                    name: profileName,
                                    countryCode: defaultCountryCode,
                                    mobileNumber: parsedPhoneNumber,
                                    whatsappId,
                                    profileName
                                });
                            } else {
                                let updated = false;

                                if (profileName && contact.profileName !== profileName) {
                                    contact.profileName = profileName;
                                    updated = true;
                                }

                                if (profileName && contact.name !== profileName) {
                                    contact.name = profileName;
                                    updated = true;
                                }

                                if (updated) {
                                    await contact.save();
                                } else {
                                    console.log(`[Inbound Message] Contact already up-to-date: ${contact._id}`);
                                }
                            }
 
                            let conversation = await Conversation.findOne({
                                projectId: project._id,
                                contactId: contact._id,
                                metaPhoneNumberID: metaPhoneNumberID
                            });
 
                            if (!conversation) {
                                conversation = await Conversation.create({
                                    tenantId: project.tenantId,
                                    userId: project.userId,
                                    projectId: project._id,
                                    contactId: contact._id,
                                    metaPhoneNumberID: metaPhoneNumberID,
                                    latestMessage: messageContent.body || messageType,
                                    latestMessageType: messageType,
                                    lastActivityAt: timestamp,
                                    unreadCount: 1
                                });
                            } else {
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
                                from: fromPhoneNumber,
                                direction: 'inbound',
                                type: messageType,
                                message: messageContent,
                                metaMessageId: metaMessageId,
                                status: 'received',
                                sentAt: timestamp
                            });

                            if ((messageType === 'text' && messageContent?.body) || (messageType === 'button' && messageContent?.payload)) {
                                const userText = messageType === 'text' ? messageContent.body.trim() : messageContent.payload.trim();
                                const phoneNumberId = metaPhoneNumberID;
                                const accessToken = businessProfileData.metaAccessToken;
                                const userNumber = fromPhoneNumber;

                                try {;
                                    const flow = await Flow.findOne({ 
                                        tenantId: project.tenantId,
                                        userId: project.userId,
                                        projectId: project._id,
                                        entryPoint: userText
                                    });

                                    if (flow) {
                                        const replies = await traverseFlow(userText, flow.nodes, flow.edges);
                                        console.log("==========replies", replies);

                                        const buildPayload = (reply) => {
                                            switch (reply.type) {
                                                case 'text':
                                                    return {
                                                        type: 'text',
                                                        message: { text: reply.text }
                                                    };
                                                case 'image':
                                                case 'video':
                                                    return {
                                                        type: reply.type,
                                                        message: {
                                                            id: reply.id,
                                                            link: reply.link,
                                                            caption: reply.caption || ''
                                                        }
                                                    };
                                                case 'audio':
                                                    return {
                                                        type: 'audio',
                                                        message: {
                                                            id: reply.id,
                                                            link: reply.link
                                                        }
                                                    };
                                                case 'template':
                                                return {
                                                    type: 'template',
                                                    message: {
                                                    name: reply.templateName,
                                                    language: { code: reply.templateLang },
                                                    components: reply.components || []
                                                    }
                                                };
                                                case 'document':
                                                return {
                                                    type: 'document',
                                                    message: {
                                                    ...(reply.id ? { id: reply.id } : { link: reply.link, filename: reply.filename }),
                                                    caption: reply.caption || ''
                                                    }
                                                };

                                                default:
                                                    console.warn(`Unsupported reply type: ${reply.type}`);
                                                    return null;
                                            }
                                        };

                                        const tasks = replies
                                            .map(buildPayload)
                                            .filter(Boolean)
                                            .map(({ type, message }) =>
                                                sendWhatsAppMessages({
                                                    to: userNumber,
                                                    type,
                                                    message,
                                                    phoneNumberId,
                                                    accessToken,
                                                    FACEBOOK_URL: "https://graph.facebook.com/v22.0"
                                                })
                                            );

                                        const results = await Promise.allSettled(tasks);

                                        const existingSession = await ConversationSession.findOne({
                                            userId: project.userId,
                                            tenantId: project.tenantId,
                                            whatsappContactId: userNumber,
                                            whatsappPhoneNumberId: phoneNumberId,
                                            projectId: project._id,
                                        });

                                        if (!existingSession) {
                                            await ConversationSession.create({
                                                whatsappContactId: userNumber,
                                                whatsappPhoneNumberId: phoneNumberId,
                                                projectId: project._id,
                                                userId: project.userId,
                                                tenantId: project.tenantId,
                                            });
                                        }

                                        results.forEach((r, i) => {
                                            if (r.status === 'fulfilled' && r.value?.success) {
                                                console.log(`Reply[${i}] sent to ${userNumber}`);
                                            } else {
                                                console.error(`Reply[${i}] failed`, r.reason || r.value?.error);
                                            }
                                        });
                                    } else {
                                        if (io) {
                                            io.to(project.userId.toString()).emit('newInboundMessage', {
                                                message: messageDoc.toObject(),
                                                conversation: conversation.toObject(),
                                                contact: contact.toObject()
                                            });
                                            io.to(conversation._id.toString()).emit('newChatMessage', {
                                                message: messageDoc.toObject(),
                                                contact: contact.toObject(),
                                                conversationId: conversation._id
                                            });
                                        }
                                    }
                                } catch (err) {
                                    console.error(`Error during auto-reply for "${userText}":`, err.message);
                                }
                            }

                        }
                    }
                }
            }
        }
        return { status: statusCode.OK, success: true, message: resMessage.WEBHOOK_RECEIVE_SUCCESS };
    } catch (error) {
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
        return { status: statusCode.INTERNAL_SERVER_ERROR, success: false, message: error.message || resMessage.Server_error };
    }
};