// // server/services/webhookService.js
// const Message = require("../models/Message");
// const Contact = require("../models/Contact");
// const Conversation = require("../models/ConversationSchema"); // FIX: Corrected model import
// const Project = require("../models/Project");
// const { statusCode, resMessage } = require('../config/constants');
// const crypto = require('crypto'); // For webhook signature verification (future enhancement)


// /**
//  * Handles incoming WhatsApp webhook payloads for message status updates and inbound messages.
//  * This is the main entry point for Meta's webhooks.
//  * @param {Object} req - The request object from Express (contains params, body, io instance).
//  * @returns {Object} Success status and message.
//  */
// exports.handleWebhookPayload = async (req) => {
//     const io = req.app.get('io'); // Get Socket.IO instance

//     // 1. Webhook Verification Request (GET)
//     if (req.method === 'GET') {
//         const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // Get from environment variables
//         const mode = req.query['hub.mode'];
//         const token = req.query['hub.verify_token'];
//         const challenge = req.query['hub.challenge'];

//         console.log("Webhook GET request received for verification.");
//         console.log("Mode:", mode, "Token:", token, "Challenge:", challenge);

//         if (mode && token) {
//             if (mode === 'subscribe' && token === VERIFY_TOKEN) {
//                 console.log('WEBHOOK_VERIFIED');
//                 // For GET verification, Meta expects a plain text response with the challenge
//                 return { status: statusCode.OK, raw: true, body: challenge }; // Using custom 'raw' flag for responseHandler
//             } else {
//                 console.error('Webhook verification failed: Invalid verify token or mode.');
//                 return { status: statusCode.FORBIDDEN, success: false, message: resMessage.WEBHOOK_INVALID_VERIFY_TOKEN };
//             }
//         }
//         console.warn("Invalid verification request: Missing mode or token.");
//         return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid verification request." };
//     }

//     // 2. Incoming Webhook Event (POST)
//     const payload = req.body;
//     console.log("Incoming webhook POST payload:", JSON.stringify(payload, null, 2));

//     try {
//         if (!payload || !payload.object || payload.object !== 'whatsapp_business_account') {
//             console.warn("Webhook payload not for whatsapp_business_account or invalid object:", payload);
//             return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid webhook object type." };
//         }

//         for (const entry of payload.entry) {
//             // Determine the Meta Phone Number ID from the entry metadata
//             // It's typically found in `entry.changes[0].value.metadata.phone_number_id` or `entry.changes[0].value.metadata.display_phone_number`
//             // Let's look for phone_number_id directly in the first change's value.
//             const metaPhoneNumberID = entry.changes?.[0]?.value?.metadata?.phone_number_id;

//             if (!metaPhoneNumberID) {
//                 console.warn("Could not extract Meta Phone Number ID from webhook payload entry. Skipping this entry.", JSON.stringify(entry));
//                 continue; // Skip to next entry if phone number ID isn't found
//             }

//             for (const change of entry.changes) {
//                 if (change.field === 'messages') {
//                     const value = change.value;

//                     // Message Status Updates (for outbound messages sent by us)
//                     if (value.statuses) {
//                         for (const statusUpdate of value.statuses) {
//                             const metaMessageId = statusUpdate.id;
//                             const newStatus = statusUpdate.status;
//                             const timestamp = new Date(parseInt(statusUpdate.timestamp) * 1000);

//                             console.log(`Webhook status update: Meta ID=${metaMessageId}, Status=${newStatus}`);

//                             const messageDoc = await Message.findOne({ metaMessageId: metaMessageId, metaPhoneNumberID: metaPhoneNumberID }); // Also filter by phone number ID
//                             if (messageDoc) {
//                                 messageDoc.status = newStatus;
//                                 messageDoc.updatedAt = new Date();
//                                 messageDoc.sentAt = timestamp;
//                                 if (statusUpdate.errors && statusUpdate.errors.length > 0) {
//                                     messageDoc.errorDetails = statusUpdate.errors;
//                                 }
//                                 await messageDoc.save();
//                                 console.log(`Message ${metaMessageId} status updated to ${newStatus}.`);

//                                 if (io) {
//                                     io.to(messageDoc.userId.toString()).emit('messageStatusUpdate', {
//                                         messageDbId: messageDoc._id,
//                                         metaMessageId,
//                                         newStatus,
//                                         to: messageDoc.to,
//                                         projectId: messageDoc.projectId,
//                                         sentAt: messageDoc.sentAt,
//                                         type: messageDoc.type,
//                                         conversationId: messageDoc.conversationId
//                                     });
//                                     if (messageDoc.conversationId) {
//                                         io.to(messageDoc.conversationId.toString()).emit('messageStatusUpdate', {
//                                             messageDbId: messageDoc._id,
//                                             metaMessageId,
//                                             newStatus,
//                                             to: messageDoc.to,
//                                             projectId: messageDoc.projectId,
//                                             sentAt: messageDoc.sentAt,
//                                             type: messageDoc.type,
//                                             conversationId: messageDoc.conversationId
//                                         });
//                                     }
//                                 }
//                             } else {
//                                 console.warn(`Outbound Message with Meta ID ${metaMessageId} and Phone ID ${metaPhoneNumberID} not found in DB for status update.`);
//                             }
//                         }
//                     }

//                     // Inbound Messages (messages coming from WhatsApp users to our WABA number)
//                     if (value.messages) {
//                         for (const inboundMessage of value.messages) {
//                             const fromPhoneNumber = inboundMessage.from;
//                             const whatsappId = inboundMessage.from; // Assuming wa_id is same as from for simplicity
//                             const messageType = inboundMessage.type;
//                             const messageContent = inboundMessage[messageType];
//                             const metaMessageId = inboundMessage.id;
//                             const timestamp = new Date(parseInt(inboundMessage.timestamp) * 1000);
//                             const profileName = inboundMessage.contacts?.[0]?.profile?.name || fromPhoneNumber; // Get display name if available

//                             console.log(`Inbound Message: From=${fromPhoneNumber}, Type=${messageType}, ID=${metaMessageId}, Received on Meta Phone ID: ${metaPhoneNumberID}`);

//                             // 1. Find the Project associated with the incoming metaPhoneNumberID
//                             const project = await Project.findOne({ metaPhoneNumberID: metaPhoneNumberID });

//                             if (!project) {
//                                 console.warn(`No project found for metaPhoneNumberID: ${metaPhoneNumberID}. Cannot process inbound message.`);
//                                 continue; // Skip this inbound message if no project is linked to the phone number
//                             }

//                             // 2. Find or Create Contact
//                             let contact = await Contact.findOne({
//                                 projectId: project._id,
//                                 userId: project.userId,
//                                 mobileNumber: fromPhoneNumber.replace(/^\+/, ''),
//                                 whatsappId: whatsappId
//                             });

//                             if (!contact) {
//                                 const parsedPhoneNumber = fromPhoneNumber.replace(/^\+/, ''); // Remove '+' for consistency
//                                 // Basic attempt to separate country code and mobile number
//                                 let defaultCountryCode = '';
//                                 let defaultMobileNumber = parsedPhoneNumber;
//                                 if (parsedPhoneNumber.length > 10) { // Assuming typical 10-digit mobile number + country code
//                                     defaultCountryCode = parsedPhoneNumber.substring(0, parsedPhoneNumber.length - 10);
//                                     defaultMobileNumber = parsedPhoneNumber.substring(parsedPhoneNumber.length - 10);
//                                 }

//                                 console.log(`Creating new contact for ${fromPhoneNumber} in project ${project._id}`);
//                                 contact = await Contact.create({
//                                     tenantId: project.tenantId,
//                                     userId: project.userId,
//                                     projectId: project._id,
//                                     name: profileName,
//                                     countryCode: defaultCountryCode,
//                                     mobileNumber: defaultMobileNumber,
//                                     whatsappId: whatsappId,
//                                     profileName: profileName
//                                 });
//                             } else if (contact.profileName !== profileName) {
//                                 contact.profileName = profileName;
//                                 await contact.save();
//                             }

//                             // 3. Find or Create Conversation
//                             let conversation = await Conversation.findOne({
//                                 projectId: project._id,
//                                 contactId: contact._id,
//                                 metaPhoneNumberID: metaPhoneNumberID // Ensure conversation is tied to the specific phone number
//                             });

//                             if (!conversation) {
//                                 console.log(`Creating new conversation for project ${project._id} with contact ${contact._id} via phone ID ${metaPhoneNumberID}`);
//                                 conversation = await Conversation.create({
//                                     tenantId: project.tenantId,
//                                     userId: project.userId,
//                                     projectId: project._id,
//                                     contactId: contact._id,
//                                     metaPhoneNumberID: metaPhoneNumberID,
//                                     latestMessage: messageContent.body || messageType,
//                                     latestMessageType: messageType,
//                                     lastActivityAt: timestamp,
//                                     unreadCount: 1
//                                 });
//                             } else {
//                                 conversation.latestMessage = messageContent.body || messageType;
//                                 conversation.latestMessageType = messageType;
//                                 conversation.lastActivityAt = timestamp;
//                                 conversation.unreadCount = (conversation.unreadCount || 0) + 1;
//                                 conversation.isActive = true;
//                                 await conversation.save();
//                             }

//                             // 4. Save the Inbound Message
//                             const messageDoc = await Message.create({
//                                 tenantId: project.tenantId,
//                                 userId: project.userId,
//                                 projectId: project._id,
//                                 conversationId: conversation._id,
//                                 metaPhoneNumberID: metaPhoneNumberID,
//                                 from: fromPhoneNumber,
//                                 direction: 'inbound',
//                                 type: messageType,
//                                 message: messageContent,
//                                 metaMessageId: metaMessageId,
//                                 status: 'received',
//                                 sentAt: timestamp
//                             });
//                             console.log("Inbound message saved to DB:", messageDoc._id);

//                             // 5. Emit the new message for real-time update
//                             if (io) {
//                                 io.to(project.userId.toString()).emit('newInboundMessage', {
//                                     message: messageDoc.toObject(),
//                                     conversation: conversation.toObject(),
//                                     contact: contact.toObject()
//                                 });
//                                 io.to(conversation._id.toString()).emit('newChatMessage', {
//                                     message: messageDoc.toObject(),
//                                     contact: contact.toObject(),
//                                     conversationId: conversation._id
//                                 });
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//         return { status: statusCode.OK, success: true, message: resMessage.WEBHOOK_RECEIVE_SUCCESS };
//     } catch (error) {
//         console.error("Error processing webhook payload:", error.stack);
//         return { status: statusCode.INTERNAL_SERVER_ERROR, success: false, message: error.message || resMessage.Server_error };
//     }
// };

const axios = require('axios');
const { statusCode, resMessage } = require('../config/constants');

exports.getPhoneNumbersFromMeta = async ({
    wabaId,
    accessToken,
    facebookUrl = 'https://graph.facebook.com',
    graphVersion = 'v19.0'
}) => {
    if (!wabaId || !accessToken) {
        return {
            success: false,
            status: statusCode.BAD_REQUEST,
            message: resMessage.WABA_ID_and_ACCESS_TOKEN_REQUIRED
        };
    }

    const url = `${facebookUrl}/${graphVersion}/${wabaId}/phone_numbers`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const phoneNumbers = response.data.data || [];

        return {
            success: true,
            status: statusCode.OK,
            message: resMessage.WhatsApp_numbers_fetched_successfully,
            data: phoneNumbers
        };
    } catch (error) {
        const metaError = error.response?.data?.error;
        const fbMessage = metaError?.message || error.message;
        const fbCode = metaError?.code;

        // 🔴 Custom response for known Meta errors
        let userFriendlyMessage = `Failed to fetch phone numbers from Meta.`;

        if (fbCode === 190) {
            userFriendlyMessage = "Invalid or expired access token, or the app has been deleted from Meta.";
        } else if (fbCode === 100 && fbMessage.includes('param')) {
            userFriendlyMessage = "Invalid WABA ID or missing parameter.";
        }

        console.error("Meta API Error:", metaError);

        return {
            success: false,
            // status: error.response?.status || statusCode.INTERNAL_SERVER_ERROR,
            status:  statusCode.META_ERROR,
            message: userFriendlyMessage,
            metaError,
        };
    }
};
