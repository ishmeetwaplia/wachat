// server/controllers/templateController.js
const templateService = require('../services/templateService');
const{ statusCode, resMessage } = require('../config/constants');

exports.createController = async (req) => {
    return await templateService.createTemplate(req);
};
exports.uploadMedia = async (req) => {
    return await templateService.uploadMedia(req);
};

exports.submitToMetaController = async (req) => {
    return await templateService.submitTemplateToMeta(req);
};

exports.getAllController = async (req) => {
    return await templateService.getAllTemplates(req);
};

exports.createCarouselTemplateController = async (req) => {
    return await templateService.createCarouselTemplate(req);
};

exports.getByIdController = async (req) => {
    return await templateService.getTemplateById(req);
};
exports.getAllApprovedTemplatesController = async (req) => {
    return await templateService.getAllApprovedTemplates(req);
};
exports.getAllApprovedCarosualTemplatesController = async (req) => {
    return await templateService.getAllCarouselTemplates(req);
};

exports.updateController = async (req) => {
    return await templateService.updateTemplate(req);
};

exports.deleteController = async (req) => {
    return await templateService.deleteTemplate(req);
};

// NEW: Controller for synchronizing templates from Meta
exports.syncTemplatesFromMetaController = async (req) => {
    return await templateService.syncTemplatesFromMeta(req);
};

exports.authTemplateController = async (req) => {
    try {
        return await templateService.authTemplate(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}

exports.getPlainTextController = async (req) => {
  return await templateService.getPlainTextTemplates(req);
};