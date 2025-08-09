const { sendBulkMessageService, getAllBulkSendJobsService, getBulkSendJobDetailsService } = require('../services/messageService');
const messageService = require("../services/messageService");
const fs = require("fs");
const path = require("path");

exports.sendMessageController = async (req) => {
    return await messageService.sendMessageService(req);
};

exports.sendBulkMessageController = async (req) => {
    return await sendBulkMessageService(req);
};

exports.uploadMedia = async (req) => {
    return await messageService.uploadMedia(req);
};

exports.getBulkSendJobDetailsService = async (req) => {
    return await getBulkSendJobDetailsService(req);
};

exports.getAllBulkSendJobsService = async (req) => {
    return await messageService.getAllBulkSendJobsService(req);
};
exports.BulkSendGroupController = async (req) => {
    return await messageService.BulkSendGroupService(req);
};

exports.downloadMediaController = async (req, res) => {
  try {
    const result = await messageService.downloadMedia(req); // Pass only req

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.setHeader("Content-Type", result.mimeType);
    
    // ✅ Force download instead of inline preview
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );

    // ✅ Delete temp file after response is fully sent
    res.on("finish", () => {
      const filePath = path.join(__dirname, `../temp/${result.fileName}`);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("❌ Error deleting temp file:", err.message);
        } else {
          console.log("🗑️ Temp file deleted after download:", result.fileName);
        }
      });
    });

    // Pipe stream to response
    result.stream.pipe(res);
  } catch (err) {
    console.error("❌ Controller error in downloading media:", err.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

