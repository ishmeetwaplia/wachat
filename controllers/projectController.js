const projectService = require('../services/projectService');
const { statusCode, resMessage } = require('../config/constants');

exports.createProjectController = async (req) => {
    return await projectService.createProject(req);
};

exports.getAllProjectsController = async (req) => {
    return await projectService.getAllProjects(req);
};

exports.getProjectByIdController = async (req) => {
    return await projectService.getProjectById(req);
};

exports.updateProjectController = async (req) => {
    return await projectService.updateProject(req);
};

exports.deleteProjectController = async (req) => {
    return await projectService.deleteProject(req);
};

exports.updateWhatsappBusinessProfileController = async (req) => {
    const { projectId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const profileData = req.body;

    if (Object.keys(profileData).length === 0) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (Profile data is required for update)."
        };
    }

    return await projectService.updateWhatsappBusinessProfileOnMeta({
        projectId,
        userId,
        tenantId,
        profileData
    });
};

exports.getBatchSizeController = async (req) => {
    try {
        return await projectService.getBatchSize(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
}

exports.updateBatchSizeController = async (req) => {
    try {
        return await projectService.updateBatchSize(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
}