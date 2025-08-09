// server/controllers/flowController.js
const flowService = require('../services/flowService');
const { statusCode } = require('../config/constants');

exports.createController = async (req) => {
    try {
        return await flowService.create(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}

exports.getFlowsController = async (req) => {
    const { projectId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.getFlows({ projectId, userId, tenantId });
};

exports.getFlowByIdController = async (req) => {
    const { projectId, flowId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.getFlowById({ flowId, projectId, userId, tenantId });
};

exports.updateFlowController = async (req) => {
    try {
        return await flowService.update(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
};

exports.deleteFlowByIdController = async (req) => {
    const { projectId, flowId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    return await flowService.deleteFlowById({ flowId, projectId, userId, tenantId });
};

// /**
//  * @desc    Delete a conversational flow.
//  * @route   DELETE /api/projects/:projectId/flows/:flowId
//  * @access  Private (User/Team Member)
//  */
// exports.deleteFlowController = async (req) => {
//     const { projectId, flowId } = req.params;
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;

//     return await flowService.deleteFlow({ flowId, projectId, userId, tenantId });
// };



// server/controllers/flowController.js
// const flowService = require('../services/flowService');
// const { statusCode, resMessage } = require('../config/constants');

// /**
//  * @desc    Create a new conversational flow.
//  * @route   POST /api/projects/:projectId/flows
//  * @access  Private (User/Team Member)
//  */
// exports.createFlowController = async (req) => {
//     const { projectId } = req.params;
//     console.log("req.params", req.params);
//     console.log("projectId", projectId);
//     // Extract name, triggerKeyword, nodes, edges directly from req.body
//     const { name, triggerKeyword, nodes, edges, description, status } = req.body;
//     const userId = req.user._id; // Assuming req.user is set by auth middleware
//     const tenantId = req.tenant._id; // Assuming req.tenant is set by auth middleware

//     return await flowService.createFlow({
//         name,
//         triggerKeyword,
//         nodes,
//         edges,
//         projectId,
//         userId,
//         tenantId,
//         description,
//         status,
//     });
// };

// /**
//  * @desc    Get all conversational flows for a specific project.
//  * @route   GET /api/projects/:projectId/flows
//  * @access  Private (User/Team Member)
//  */
// exports.getFlowsController = async (req) => {
//     const { projectId } = req.params;
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;

//     return await flowService.getFlows({ projectId, userId, tenantId });
// };

// /**
//  * @desc    Get a single conversational flow by ID.
//  * @route   GET /api/projects/:projectId/flows/:flowId
//  * @access  Private (User/Team Member)
//  */
// exports.getFlowByIdController = async (req) => {
//     const { projectId, flowId } = req.params;
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;

//     return await flowService.getFlowById({ flowId, projectId, userId, tenantId });
// };

// /**
//  * @desc    Update an existing conversational flow.
//  * @route   PUT /api/projects/:projectId/flows/:flowId
//  * @access  Private (User/Team Member)
//  */
// exports.updateFlowController = async (req) => {
//     const { projectId, flowId } = req.params;
//     const updateData = req.body; // Contains fields to update (name, triggerKeyword, nodes, edges, status, etc.)
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;

//     return await flowService.updateFlow({ flowId, projectId, userId, tenantId }, updateData);
// };

// /**
//  * @desc    Delete a conversational flow.
//  * @route   DELETE /api/projects/:projectId/flows/:flowId
//  * @access  Private (User/Team Member)
//  */
// exports.deleteFlowController = async (req) => {
//     const { projectId, flowId } = req.params;
//     const userId = req.user._id;
//     const tenantId = req.tenant._id;

//     return await flowService.deleteFlow({ flowId, projectId, userId, tenantId });
// };
