// // server/services/flowService.js
const Flow = require('../models/Flow');
const { statusCode, resMessage } = require('../config/constants');
const Project = require("../models/project");

exports.create = async (req) => {
    try {
        const { name, nodes, edges } = req.body;
        const checkProject = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
        if (!checkProject) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            }
        }

        if (!Array.isArray(nodes) || nodes.length === 0) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.nodes_array_is_required,
            };
        }

        if (!Array.isArray(edges)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.edges_array_is_required,
            };
        }

        const entryNode = nodes.find(n => n.id === 'node_0' && n.data?.message);
        const entryPoint = entryNode?.data?.message?.toLowerCase();

        if (!entryPoint) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Project not found or unauthorized).",
            };
        }

        const existingFlow = await Flow.findOne({ name, projectId: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id });
        if (existingFlow) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Flow_name_exists,
            };
        }

        const savedFlow = await Flow.create({
            projectId: req.params.projectId,
            userId: req.user._id,
            tenantId: req.tenant._id,
            entryPoint,
            nodes,
            edges,
            name
        });

        return {
            status: statusCode.CREATED, // Changed to CREATED (201) for new resource
            success: true,
            message: resMessage.Flow_created_successfully,
            data: savedFlow,
        };
    } catch (error) {
        console.error("Error creating flow:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR,
        };
    }
};

exports.getFlows = async ({ projectId, userId, tenantId }) => {
    if (!projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (projectId, userId, tenantId are required)."
        };
    }

    try {
        const flows = await Flow.find({ projectId, userId, tenantId }).lean();
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flows_fetched_successfully,
            data: flows,
        };
    } catch (error) {
        console.error("Error fetching flows:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};

exports.getFlowById = async ({ flowId, projectId, userId, tenantId }) => {
    if (!flowId || !projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
        };
    }

    try {
        const flow = await Flow.findOne({ _id: flowId, projectId, userId, tenantId }).lean();
        if (!flow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Flow not found or unauthorized)."
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_fetched_successfully,
            data: flow,
        };
    } catch (error) {
        console.error("Error fetching flow by ID:", error);
        if (error.name === "CastError") {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid Flow ID format.",
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};

exports.update = async (req) => {
    try {
        const { name, nodes, edges } = req.body;
        const { flowId, projectId } = req.params;

        const checkProject = await Project.findOne({
            _id: projectId,
            userId: req.user._id,
            tenantId: req.tenant._id,
        });
        if (!checkProject) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.ProjectId_dont_exists,
                statusCode: statusCode.NOT_FOUND,
            };
        }

        if (!Array.isArray(nodes) || nodes.length === 0) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.nodes_array_is_required,
            };
        }

        if (!Array.isArray(edges)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.edges_array_is_required,
            };
        }

        const entryNode = nodes.find(n => n.id === 'node_0' && n.data?.message);
        const entryPoint = entryNode?.data?.message?.toLowerCase();

        if (!entryPoint) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Entry point missing).",
            };
        }

        const existingFlow = await Flow.findOne({
            _id: flowId,
            projectId,
            userId: req.user._id,
            tenantId: req.tenant._id,
        });

        if (!existingFlow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Flow_not_found,
            };
        }

        if (name && name !== existingFlow.name) {
            const nameConflict = await Flow.findOne({
                name,
                projectId,
                userId: req.user._id,
                tenantId: req.tenant._id,
                _id: { $ne: flowId },
            });

            if (nameConflict) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Flow_name_exists,
                };
            }
        }

        existingFlow.name = name;
        existingFlow.nodes = nodes;
        existingFlow.edges = edges;
        existingFlow.entryPoint = entryPoint;
        await existingFlow.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_updated_successfully,
            data: existingFlow,
        };
    } catch (error) {
        console.error("Error updating flow:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR,
        };
    }
};

exports.deleteFlowById = async ({ flowId, projectId, userId, tenantId }) => {
    if (!flowId || !projectId || !userId || !tenantId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
        };
    }

    try {
        const deletedFlow = await Flow.findOneAndDelete({
            _id: flowId,
            projectId,
            userId,
            tenantId
        });

        if (!deletedFlow) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Flow not found or unauthorized)."
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Flow_deleted_successfully,
        };
    } catch (error) {
        console.error("Error deleting flow:", error);
        if (error.name === "CastError") {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Invalid Flow ID format.",
            };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error,
        };
    }
};


// exports.deleteFlow = async ({ flowId, projectId, userId, tenantId }) => {
//     if (!flowId || !projectId || !userId || !tenantId) {
//         return {
//             status: statusCode.BAD_REQUEST,
//             success: false,
//             message: resMessage.Missing_required_fields + " (flowId, projectId, userId, tenantId are required)."
//         };
//     }

//     try {
//         const deletedFlow = await Flow.findOneAndDelete({ _id: flowId, projectId, userId, tenantId });

//         if (!deletedFlow) {
//             return {
//                 status: statusCode.NOT_FOUND,
//                 success: false,
//                 message: resMessage.No_data_found + " (Flow not found or unauthorized)."
//             };
//         }

//         return {
//             status: statusCode.OK,
//             success: true,
//             message: resMessage.Flow_deleted_successfully,
//         };
//     } catch (error) {
//         console.error("Error deleting flow:", error);
//         if (error.name === "CastError") {
//             return {
//                 status: statusCode.BAD_REQUEST,
//                 success: false,
//                 message: "Invalid Flow ID format.",
//             };
//         }
//         return {
//             status: statusCode.INTERNAL_SERVER_ERROR,
//             success: false,
//             message: error.message || resMessage.Server_error,
//         };
//     }
// };