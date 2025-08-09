// server/services/teamMemberService.js
const User = require('../models/User');
const Project = require('../models/project'); // To ensure project exists
const { statusCode, resMessage } = require('../config/constants');

// @desc    Create a new team member for a specific project
// @access  Private (Tenant Admin or Project Admin)
exports.createTeamMember = async (req) => {
    const { firstName, lastName, mobileNumber, username, email, password, permissions } = req.body;
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id; // From tenantResolver middleware
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;

    // Permissions check: Only tenant_admin or the project owner can add team members
    // For now, let's assume tenant_admin or the actual project owner (if project owner can add team members)
    // To check if current user is project owner, you'd need to fetch the project:
    const project = await Project.findById(projectId);
    if (!project) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.No_data_found // Project not found
        };
    }

    const isProjectOwner = project.userId.toString() === currentUserId.toString(); // Assuming project has a userId field for owner

    if (currentUserRole !== 'tenant_admin' && !isProjectOwner) {
        return {
            status: statusCode.FORBIDDEN,
            success: false,
            message: resMessage.Unauthorized_action
        };
    }

    if (!username || !email || !password || !firstName || !mobileNumber) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields
        };
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }], tenantId }); // Check uniqueness within the tenant
        if (existingUser) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Team_member_already_exists
            };
        }

        const teamMember = await User.create({
            tenantId,
            projectId, // Link to the project
            firstName,
            lastName,
            mobileNumber,
            username,
            email,
            password, // Password will be hashed by pre-save hook
            permissions: permissions || [], // Assign permissions, default to empty array
            role: 'team-member' // Explicitly set role
        });

        // Exclude password from the returned object
        const teamMemberResponse = teamMember.toObject();
        delete teamMemberResponse.password;

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Team_member_created_successfully,
            data: teamMemberResponse
        };
    } catch (error) {
        console.error("Error creating team member:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Get all team members for a specific project
// @access  Private (Tenant Admin or Project Owner)
exports.getAllTeamMembers = async (req) => {
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.No_data_found // Project not found
        };
    }
    const isProjectOwner = project.userId.toString() === currentUserId.toString();

    if (currentUserRole !== 'tenant_admin' && !isProjectOwner) {
        return {
            status: statusCode.FORBIDDEN,
            success: false,
            message: resMessage.Unauthorized_action
        };
    }

    try {
        const teamMembers = await User.find({ tenantId, projectId, role: 'team-member' }).select('-password'); // Exclude password
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Team_member_fetched_successfully,
            data: teamMembers
        };
    } catch (error) {
        console.error("Error fetching team members:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Get a specific team member by ID
// @access  Private (Tenant Admin or Project Owner)
exports.getTeamMemberById = async (req) => {
    const teamMemberId = req.params.id;
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.No_data_found // Project not found
        };
    }
    const isProjectOwner = project.userId.toString() === currentUserId.toString();

    try {
        const teamMember = await User.findOne({ _id: teamMemberId, tenantId, projectId, role: 'team-member' }).select('-password');

        if (!teamMember) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Team_member_not_found
            };
        }

        // Additional authorization: ensure tenant_admin or project owner can view this specific team member
        if (currentUserRole !== 'tenant_admin' && !isProjectOwner) {
             return {
                status: statusCode.FORBIDDEN,
                success: false,
                message: resMessage.Unauthorized_action
            };
        }

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Team_member_fetched_successfully,
            data: teamMember
        };
    } catch (error) {
        console.error("Error fetching team member by ID:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid team member ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Update a team member's details
// @access  Private (Tenant Admin or Project Owner)
exports.updateTeamMember = async (req) => {
    const teamMemberId = req.params.id;
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;
    const { firstName, lastName, mobileNumber, username, email, password, permissions, isActive } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.No_data_found // Project not found
        };
    }
    const isProjectOwner = project.userId.toString() === currentUserId.toString();

    if (currentUserRole !== 'tenant_admin' && !isProjectOwner) {
        return {
            status: statusCode.FORBIDDEN,
            success: false,
            message: resMessage.Unauthorized_action
        };
    }

    try {
        const teamMember = await User.findOne({ _id: teamMemberId, tenantId, projectId, role: 'team-member' });

        if (!teamMember) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Team_member_not_found
            };
        }

        // Prevent updating role to something other than 'team-member' or 'user' (if user allows internal role changes)
        // For simplicity, enforce 'team-member' for these routes
        if (req.body.role && req.body.role !== 'team-member') {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: "Role cannot be changed to non 'team-member' through this endpoint."
            };
        }

        // Check for duplicate email/username if they are being changed
        if (email && email !== teamMember.email) {
            const emailExists = await User.findOne({ email, tenantId, _id: { $ne: teamMemberId } });
            if (emailExists) {
                return { status: statusCode.CONFLICT, success: false, message: resMessage.Team_member_already_exists };
            }
        }
        if (username && username !== teamMember.username) {
            const usernameExists = await User.findOne({ username, tenantId, _id: { $ne: teamMemberId } });
            if (usernameExists) {
                return { status: statusCode.CONFLICT, success: false, message: resMessage.Team_member_already_exists };
            }
        }

        teamMember.firstName = firstName !== undefined ? firstName : teamMember.firstName;
        teamMember.lastName = lastName !== undefined ? lastName : teamMember.lastName;
        teamMember.mobileNumber = mobileNumber !== undefined ? mobileNumber : teamMember.mobileNumber;
        teamMember.username = username !== undefined ? username : teamMember.username;
        teamMember.email = email !== undefined ? email : teamMember.email;
        teamMember.permissions = permissions !== undefined ? permissions : teamMember.permissions;
        teamMember.isActive = isActive !== undefined ? isActive : teamMember.isActive;

        if (password) {
            teamMember.password = password; // Hashing will be handled by pre-save hook
        }

        const updatedTeamMember = await teamMember.save();

        const responseData = updatedTeamMember.toObject();
        delete responseData.password;

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Team_member_updated_successfully,
            data: responseData
        };
    } catch (error) {
        console.error("Error updating team member:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid team member ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

// @desc    Delete a team member
// @access  Private (Tenant Admin or Project Owner)
exports.deleteTeamMember = async (req) => {
    const teamMemberId = req.params.id;
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
        return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.No_data_found // Project not found
        };
    }
    const isProjectOwner = project.userId.toString() === currentUserId.toString();

    if (currentUserRole !== 'tenant_admin' && !isProjectOwner) {
        return {
            status: statusCode.FORBIDDEN,
            success: false,
            message: resMessage.Unauthorized_action
        };
    }

    try {
        const teamMember = await User.findOne({ _id: teamMemberId, tenantId, projectId, role: 'team-member' });

        if (!teamMember) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Team_member_not_found
            };
        }

        // Prevent deleting yourself or a tenant admin if somehow possible via this route
        if (teamMember._id.toString() === currentUserId.toString()) {
            return {
                status: statusCode.FORBIDDEN,
                success: false,
                message: "Cannot delete yourself through this endpoint."
            };
        }
        if (teamMember.role === 'tenant_admin' || teamMember.role === 'super_admin') {
             return {
                status: statusCode.FORBIDDEN,
                success: false,
                message: "Cannot delete an administrator through this endpoint."
            };
        }


        await teamMember.deleteOne(); // Using deleteOne on the document instance

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Team_member_deleted_successfully
        };
    } catch (error) {
        console.error("Error deleting team member:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid team member ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};
