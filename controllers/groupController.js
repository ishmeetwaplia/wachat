const Group = require("../models/Group");
const { statusCode, resMessage } = require("../config/constants");
const service = require('../services/groupService');

exports.createController = async (req, res) => {
    try {
        const userId = req.user._id; // From protect middleware
        const tenantId = req.tenant._id; // From tenantResolver middleware
        const projectId = req.params.projectId; // Project ID from URL
        const { title, description } = req.body;

        const existingData = await Group.findOne({ tenantId, userId, projectId, title });
        if (existingData) {
            return res.status(statusCode.CONFLICT).json({
                success: false,
                message: resMessage.Group_already_exists
            });
        }
        
        const group = await Group.create({ tenantId, userId, projectId, title, description });
        return res.status(statusCode.CREATED).json({
            success: true,
            message: resMessage.Group_created,
            data: group
        });
    } catch (error) {
        console.error("Error creating group:", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Get all active groups for a specific project
// @route   GET /api/projects/:projectId/group
// @access  Private (Authenticated User)
exports.getController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.search || "";

        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isActive: true // Only active groups
        };

        if (searchText) {
            searchCondition.$or = [
                { title: { $regex: searchText, $options: "i" } },
                { description: { $regex: searchText, $options: "i" } }
            ];
        }

        const [data, totalCount] = await Promise.all([
            Group.find(searchCondition).sort({ _id: -1 }).skip(skip).limit(limit),
            Group.countDocuments(searchCondition)
        ]);

        return res.status(statusCode.OK).json({
            success: true,
            message: data.length === 0 ? resMessage.No_groups_found : resMessage.Groups_fetch_successfully,
            data,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page
            }
        });
    } catch (error) {
        console.error("Error getting groups:", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Get details of a single group for editing
// @route   GET /api/projects/:projectId/group/:groupId
// @access  Private (Authenticated User)
exports.editGetController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;

        const data = await Group.findOne({ _id: groupId, tenantId, userId, projectId });
        if(!data) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found
            });
        }
        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Groups_fetch_successfully,
            data
        });
    } catch (error) {
        console.error("Error getting group for edit:", error);
        if (error.name === 'CastError') {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid Group ID."
            });
        }
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Update a specific group
// @route   PUT /api/projects/:projectId/group/:groupId
// @access  Private (Authenticated User)
exports.editController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;
        const { title, description } = req.body;

        const data = await Group.findOne({ _id: groupId, tenantId, userId, projectId });
        if (data === null) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found // Changed from Data_not_found
            });
        }

        // Check for title conflict if title is being changed
        if (title && title !== data.title) {
            const titleConflict = await Group.findOne({ tenantId, userId, projectId, title });
            if (titleConflict) {
                return res.status(statusCode.CONFLICT).json({
                    success: false,
                    message: resMessage.Group_already_exists
                });
            }
        }

        data.title = title || data.title;
        data.description = description !== undefined ? description : data.description;
        await data.save();

        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Group_updated_successfully,
            data
        });
    } catch (error) {
        console.error("Error updating group:", error);
        if (error.name === 'CastError') {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid Group ID."
            });
        }
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

exports.deleteController = async (req) => {
    try {
        return await service.deleteById(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}

exports.updateFalseStatusController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;

        const data = await Group.findOne({ _id: groupId, tenantId, userId, projectId });
        if (data === null) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found // Changed from Data_not_found
            });
        }
        data.isActive = false;
        await data.save();
        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Group_status_updated_successfully,
            data // Optionally return updated data
        });
    } catch (error) {
        console.error("Error archiving group:", error);
        if (error.name === 'CastError') {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid Group ID."
            });
        }
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Restore (set isActive to true) a specific group from archive
// @route   PUT /api/projects/:projectId/group/removeArchive/:groupId
// @access  Private (Authenticated User)
exports.updateTrueStatusController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;

        const data = await Group.findOne({ _id: groupId, tenantId, userId, projectId, isActive: false }); // Find only inactive
        if (data === null) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found // Changed from Data_not_found
            });
        }
        data.isActive = true;
        await data.save();
        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Group_status_updated_successfully,
            data // Optionally return updated data
        });
    } catch (error) {
        console.error("Error restoring group:", error);
        if (error.name === 'CastError') {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: "Invalid Group ID."
            });
        }
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};


// @desc    Get all archived groups for a specific project
// @route   GET /api/projects/:projectId/archiveGroup
// @access  Private (Authenticated User)
exports.archiveListController = async (req, res) => {
    try {
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.search || "";

        const searchCondition = {
            tenantId,
            userId,
            projectId,
            isActive: false // Only archived groups
        };

        if (searchText) {
            searchCondition.$or = [
                { title: { $regex: searchText, $options: "i" } }, // Use 'title' for groups
                { description: { $regex: searchText, $options: "i" } }
            ];
        }

        const [data, total] = await Promise.all([
            Group.find(searchCondition).sort({ _id: -1 }).skip(skip).limit(limit),
            Group.countDocuments(searchCondition)
        ]);

        if (!data || data.length === 0) {
            return res.status(statusCode.OK).json({ // Changed to OK for empty data
                success: true,
                data: [],
                message: resMessage.No_groups_found
            });
        }

        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Groups_fetch_successfully,
            data,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error("Error fetching archived groups:", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Delete multiple groups for a specific project
// @route   DELETE /api/projects/:projectId/group
// @access  Private (Authenticated User)
exports.multiDeleteController = async (req, res) => {
    try {
        const { ids } = req.body; // Array of group IDs to delete
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;
        console.log("Multi-delete request for group IDs:", ids);

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: resMessage.No_IDs_provided_for_deletion
            });
        }

        const result = await Group.deleteMany({
            _id: { $in: ids },
            tenantId,
            userId,
            projectId
        });

        if (result.deletedCount === 0) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found
            });
        }

        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Group_deleted_successfully
        });
    } catch (error) {
        console.error("Error multi-deleting groups:", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

// @desc    Archive multiple groups for a specific project
// @route   PATCH /api/projects/:projectId/archiveGroup (Original route given PATCH /project/:id/archiveGroup)
// @access  Private (Authenticated User)
exports.multiUpdateController = async (req, res) => {
    try {
        console.log("Multi-archive request for group IDs:", {ids: req.body.ids});
        const { ids } = req.body; // Array of group IDs to archive
        const userId = req.user._id;
        const tenantId = req.tenant._id;
        const projectId = req.params.projectId;


        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(statusCode.BAD_REQUEST).json({
                success: false,
                message: resMessage.No_IDs_provided_for_updation
            });
        }

        const result = await Group.updateMany(
            {
                _id: { $in: ids },
                tenantId,
                userId,
                projectId
            },
            { $set: { isActive: false } } // Set to inactive for archiving
        );

        if (result.modifiedCount === 0) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.No_groups_found
            });
        }

        return res.status(statusCode.OK).json({
            success: true,
            message: resMessage.Groups_updated_successfully
        });
    } catch (error) {
        console.error("Error multi-updating groups (archive):", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: resMessage.Server_error,
            error: error.message
        });
    }
};

exports.bulkDeleteController = async (req) => {
    try {
        return await service.multiDelete(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}

exports.unarchiveController = async (req) => {
    try {
        return await service.unarchive(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        }
    }
}