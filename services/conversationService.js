// server/services/conversationService.js
const Conversation = require("../models/ConversationSchema"); // FIX: Corrected import from ConversationSchema to Conversation
const Message = require("../models/Message");
const Project = require("../models/Project");
const BusinessProfile = require("../models/BusinessProfile");
const { statusCode, resMessage } = require("../config/constants");
const axios = require("axios"); // For sending messages to Meta

/**
 * Helper to send a single WhatsApp message to Meta API.
 * This is duplicated from messageService for now, but consider a shared utility.
 */
const sendWhatsAppMessage = async ({
  to,
  type,
  message,
  phoneNumberId,
  accessToken,
  facebookUrl,
  graphVersion,
}) => {
  if (!phoneNumberId || !accessToken || !facebookUrl || !graphVersion) {
    return {
      success: false,
      error: resMessage.Meta_API_credentials_not_configured,
    };
  }

  const url = `${facebookUrl}/${graphVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type,
  };

  switch (type) {
    case "text":
      payload.text =
        typeof message.body === "string"
          ? { body: message.body }
          : message.body;
      break;

    case "template":
      payload.template = {
        name: message.name,
        language: {
          code: message.language.code,
        },
      };
      if (Array.isArray(message.components)) {
        payload.template.components = message.components;
      }
      break;

    case "image":
      payload.image = {};
      if (message.link) payload.image.link = message.link;
      if (message.id) payload.image.id = message.id;
      if (message.caption) payload.image.caption = message.caption;
      break;

    case "document":
      payload.document = {};
      if (message.link) payload.document.link = message.link;
      if (message.id) payload.document.id = message.id;
      if (message.filename) payload.document.filename = message.filename;
      if (message.caption) payload.document.caption = message.caption;
      break;

    case "audio":
      payload.audio = {};
      if (message.link) payload.audio.link = message.link;
      if (message.id) payload.audio.id = message.id;
      break;

    case "video":
      payload.video = {};
      if (message.link) payload.video.link = message.link;
      if (message.id) payload.video.id = message.id;
      if (message.caption) payload.video.caption = message.caption;
      break;

    default:
      return { success: false, error: resMessage.Invalid_message_type };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return { success: true, data: response.data };
  } catch (err) {
    const error = err.response?.data || err.message;
    console.error("Send WhatsApp Message Error:", error);
    return { success: false, error };
  }
};

// @desc    Get all conversations for a specific project
// @access  Private
exports.getConversationsForProject = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;

  try {
    const conversations = await Conversation.find({
      projectId,
      userId,
      tenantId,
    })
      .populate("contactId", "name mobileNumber countryCode profileName")
      .sort({ lastActivityAt: -1 })
      .lean();

    if (conversations.length === 0) {
      return {
        status: statusCode.OK,
        success: true,
        message:
          resMessage.No_data_found +
          " (No conversations found for this project).",
        data: [],
      };
    }

    return {
      status: statusCode.OK,
      success: true,
      message: "Conversations fetched successfully.",
      data: conversations,
    };
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

// @desc    Get messages for a specific conversation
// @access  Private
exports.getMessagesForConversation = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const conversationId = req.params.conversationId;

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      projectId,
      userId,
      tenantId,
    });
    if (!conversation) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message:
          resMessage.No_data_found +
          " (Conversation not found or unauthorized).",
      };
    }

    const messages = await Message.find({ conversationId })
      .sort({ sentAt: 1 })
      .lean();

    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    return {
      status: statusCode.OK,
      success: true,
      message: "Messages fetched successfully.",
      data: messages,
    };
  } catch (error) {
    console.error("Error fetching messages for conversation:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

// @desc    Send a message within a conversation (outbound from web UI)
// @access  Private
exports.sendMessageInConversation = async (req) => {
  const io = req.app.get("io");
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const conversationId = req.params.conversationId;
  const {
    messageType,
    messageContent,
    templateName,
    templateLanguage,
    templateComponents,
    mediaLink,
    mediaId,
    mediaFilename,
    mediaCaption,
  } = req.body;

  if (
    !messageType ||
    (!messageContent && messageType === "text") ||
    !conversationId
  ) {
    return {
      status: statusCode.BAD_REQUEST,
      success: false,
      message:
        resMessage.Missing_required_fields +
        " (messageType, content/conversationId are required).",
    };
  }

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      projectId,
      userId,
      tenantId,
    }).populate("contactId", "mobileNumber countryCode whatsappId name");
    if (!conversation) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message:
          resMessage.No_data_found +
          " (Conversation not found or unauthorized).",
      };
    }
    console.log("conversation:", conversation);
    const project = await Project.findById(projectId).populate(
      "businessProfileId"
    );
    if (!project || !project.businessProfileId || !project.metaPhoneNumberID) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: "Project or its linked WhatsApp configuration is missing.",
      };
    }

    const businessProfile = project.businessProfileId;
    const metaPhoneNumberID = project.metaPhoneNumberID; // Use the specific phone number from the project
    const toPhoneNumber = `${conversation.contactId.mobileNumber}`;
    console.log("toPhoneNumber:", toPhoneNumber);
    let metaPayload = {};
    let messageToSave = {};
    let typeForMeta = messageType;

    switch (messageType) {
      case "text":
        metaPayload = { body: messageContent };
        messageToSave = { body: messageContent };
        break;
      case "template":
        if (!templateName || !templateLanguage) {
          return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: "Template name and language are required.",
          };
        }
        metaPayload = {
          name: templateName,
          language: { code: templateLanguage },
          components: templateComponents ? JSON.parse(templateComponents) : [],
        };
        messageToSave = {
          name: templateName,
          language: { code: templateLanguage },
          components: templateComponents ? JSON.parse(templateComponents) : [],
        };
        break;
      case "image":
      case "document":
      case "audio":
      case "video":
        metaPayload = {
          link: mediaLink,
          id: mediaId,
          caption: mediaCaption || "",
        };
        if (messageType === "document") {
          metaPayload.filename = mediaFilename;
        }
        messageToSave = { ...metaPayload };
        break;
      default:
        return {
          status: statusCode.BAD_REQUEST,
          success: false,
          message: resMessage.Invalid_message_type,
        };
    }

    const sendResult = await sendWhatsAppMessage({
      to: toPhoneNumber,
      type: typeForMeta,
      message: metaPayload,
      phoneNumberId: metaPhoneNumberID,
      accessToken: businessProfile.metaAccessToken,
      facebookUrl:
        req.tenant.metaApi?.facebookUrl ||
        process.env.FACEBOOK_URL ||
        "https://graph.facebook.com",
      graphVersion:
        req.tenant.metaApi?.graphVersion ||
        process.env.GRAPH_VERSION ||
        "v19.0",
    });

    const newMessage = await Message.create({
      tenantId,
      userId,
      projectId,
      conversationId,
      metaPhoneNumberID,
      to: toPhoneNumber,
      direction: "outbound",
      type: typeForMeta,
      message: messageToSave,
      metaMessageId: sendResult.data?.messages?.[0]?.id,
      status: sendResult.success ? "sent" : "failed",
      metaResponse: sendResult.data,
      errorDetails: sendResult.error,
    });

    conversation.latestMessage =
      messageType === "text" ? messageContent : typeForMeta;
    conversation.latestMessageType = typeForMeta;
    conversation.lastActivityAt = newMessage.sentAt;
    conversation.unreadCount = 0;
    await conversation.save();

    if (io) {
      io.to(conversationId.toString()).emit("newChatMessage", {
        message: newMessage.toObject(),
        conversationId: conversation._id,
        contact: conversation.contactId.toObject(),
      });
      io.to(userId.toString()).emit("conversationUpdated", {
        conversation: conversation.toObject(),
        latestMessage: newMessage.toObject(),
      });
    }

    return {
      status: sendResult.success
        ? statusCode.CREATED
        : statusCode.INTERNAL_SERVER_ERROR,
      success: sendResult.success,
      message: sendResult.success
        ? resMessage.Message_sent_successfully
        : sendResult.error?.message || resMessage.Message_send_failed, // Corrected error message
      data: newMessage,
    };
  } catch (error) {
    console.error("Error sending message in conversation:", error.stack);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

// @desc    Mark all messages in a conversation as read
// @access  Private
exports.markConversationAsRead = async (req) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const projectId = req.params.projectId;
  const conversationId = req.params.conversationId;

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      projectId,
      userId,
      tenantId,
    });
    if (!conversation) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message:
          resMessage.No_data_found +
          " (Conversation not found or unauthorized).",
      };
    }

    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    return {
      status: statusCode.OK,
      success: true,
      message: "Conversation marked as read.",
      data: conversation.toObject(),
    };
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};
