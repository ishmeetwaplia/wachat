const Project = require('../models/project');
const BusinessProfile = require('../models/BusinessProfile');
const { statusCode, resMessage } = require('../config/constants');
const axios = require('axios');

exports.createProject = async (req) => {
    const {
        name, description, businessProfileId, isWhatsappVerified, assistantName,
        metaPhoneNumberID, whatsappNumber, activePlan, planDuration,
        about, address, email, websites, vertical, profilePictureUrl
    } = req.body;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    if (!name || !businessProfileId || !metaPhoneNumberID || !whatsappNumber) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (name, businessProfileId, metaPhoneNumberID, and whatsappNumber are required)."
        };
    }

    try {
        const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
        if (!businessProfile) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: "Selected Business Profile not found or does not belong to your account."
            };
        }

        const projectExists = await Project.findOne({ whatsappNumber, tenantId, userId });
        if (projectExists) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: resMessage.Project_already_exists
            };
        }

        const project = await Project.create({
            name,
            description,
            tenantId,
            userId,
            businessProfileId,
            isWhatsappVerified: isWhatsappVerified !== undefined ? isWhatsappVerified : false,
            assistantName,
            metaPhoneNumberID,
            whatsappNumber,
            activePlan,
            planDuration,

            about,
            address,
            email,
            websites,
            vertical,
            profilePictureUrl
        });

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Project_created_successfully,
            data: project
        };
    } catch (error) {
        console.error("Error creating project:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

exports.getAllProjects = async (req) => {
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        const projects = await Project.find({ tenantId, userId }).populate('businessProfileId', 'name metaBusinessId');
        if (projects.length === 0) {
            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.No_data_found,
                data: []
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Projects_fetched_successfully,
            data: projects
        };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

exports.getProjectById = async (req) => {
    const projectId = req.params.id;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId }).populate('businessProfileId', 'name metaBusinessId');

        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }
        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_fetched_successfully,
            data: project
        };
    } catch (error) {
        console.error("Error fetching project by ID:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

exports.updateProject = async (req) => {
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const {
        name, description, businessProfileId, isWhatsappVerified, assistantName,
        metaPhoneNumberID, whatsappNumber, activePlan, planDuration,
        about, address, email, websites, vertical, profilePictureUrl
    } = req.body;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId });
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        if (businessProfileId && businessProfileId.toString() !== project.businessProfileId.toString()) {
            const newBusinessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
            if (!newBusinessProfile) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: "New Business Profile not found or does not belong to your account."
                };
            }
            project.businessProfileId = businessProfileId;
        }

        if (name && name !== project.name) {
            const nameConflict = await Project.findOne({ name, tenantId, userId, businessProfileId: project.businessProfileId, _id: { $ne: projectId } });
            if (nameConflict) {
                return {
                    status: statusCode.CONFLICT,
                    success: false,
                    message: resMessage.Project_already_exists
                };
            }
        }

        project.name = name !== undefined ? name : project.name;
        project.description = description !== undefined ? description : project.description;
        project.isWhatsappVerified = isWhatsappVerified !== undefined ? isWhatsappVerified : project.isWhatsappVerified;
        project.assistantName = assistantName !== undefined ? assistantName : project.assistantName;
        project.metaPhoneNumberID = metaPhoneNumberID !== undefined ? metaPhoneNumberID : project.metaPhoneNumberID;
        project.whatsappNumber = whatsappNumber !== undefined ? whatsappNumber : project.whatsappNumber;
        project.activePlan = activePlan !== undefined ? activePlan : project.activePlan;
        project.planDuration = planDuration !== undefined ? planDuration : project.planDuration;

        project.about = about !== undefined ? about : project.about;
        project.address = address !== undefined ? address : project.address;
        project.email = email !== undefined ? email : project.email;
        project.websites = websites !== undefined ? websites : project.websites;
        project.vertical = vertical !== undefined ? vertical : project.vertical;
        project.profilePictureUrl = profilePictureUrl !== undefined ? profilePictureUrl : project.profilePictureUrl;

        await project.save();

        const updatedProject = await Project.findById(projectId).populate('businessProfileId', 'name metaBusinessId');

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_updated_successfully,
            data: updatedProject
        };
    } catch (error) {
        console.error("Error updating project:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

exports.deleteProject = async (req) => {
    const projectId = req.params.projectId;
    const tenantId = req.tenant._id;
    const userId = req.user._id;

    try {
        const project = await Project.findOne({ _id: projectId, tenantId, userId });
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        await project.deleteOne();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Project_deleted_successfully
        };
    } catch (error) {
        console.error("Error deleting project:", error);
        if (error.name === 'CastError') {
            return { status: statusCode.BAD_REQUEST, success: false, message: "Invalid Project ID format." };
        }
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

exports.updateWhatsappBusinessProfileOnMeta = async ({ projectId, userId, tenantId, profileData }) => {
    if (!projectId || !userId || !tenantId || !profileData) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (projectId, userId, tenantId, and profileData are required)."
        };
    }

    try {
        const project = await Project.findOne({ _id: projectId, userId, tenantId }).populate('businessProfileId');
        if (!project) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found + " (Project not found or unauthorized)."
            };
        }
        if (!project.metaPhoneNumberID) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Project_whatsapp_number_not_configured + " (Meta Phone Number ID is missing for this project)."
            };
        }
        if (!project.businessProfileId || !project.businessProfileId.metaAccessToken ) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Meta_API_credentials_not_configured + " for the linked Business Profile."
            };
        }
        const  facebookUrl = 'https://graph.facebook.com'
        const  graphVersion = 'v19.0'

        const { metaPhoneNumberID } = project;
        const { metaAccessToken } = project.businessProfileId;
        const url = `${facebookUrl}/${graphVersion}/${metaPhoneNumberID}/whatsapp_business_profile`;
        const metaPayload = {
            messaging_product: "whatsapp",
            ...profileData
        };

        const response = await axios.post(url, metaPayload, {
            headers: {
                'Authorization': `Bearer ${metaAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            Object.entries(profileData).forEach(([key, value]) => {
                project[key] = value;
                project.markModified(key);
            }); 

            await project.save();
            const savedProject = await Project.findById(project._id).lean();

            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.WhatsApp_Business_Profile_updated_successfully,
                data: response.data
            };
        } else {
            return {
                status: statusCode.INTERNAL_SERVER_ERROR,
                success: false,
                message: "Meta API reported failure.",
                data: response.data
            };
        }
    } catch (error) {
        console.error("Error updating WhatsApp Business Profile on Meta:", error.response?.data || error.message);
        return {
            status: error.response?.status || statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: `Failed to update WhatsApp Business Profile: ${error.response?.data?.error?.message || error.message}`,
            metaError: error.response?.data?.error || null,
        };
    }
};

exports.getBatchSize = async (req) => {
  try {
    const userData = await Project.findOne({ _id: req.params.projectId, tenantId: req.tenant._id, userId: req.user._id }).select('batch_size');
    
    if(!userData) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.USER_NOT_FOUND,
        statusCode: statusCode.BAD_REQUEST
      }
    }

    return {
      data: userData,
      status: statusCode.OK,
      success: true,
      message: resMessage.Data_fetch_successfully,
      statusCode: statusCode.BAD_REQUEST
    }
  } catch (error) {
    console.error("Error in Getting batch size User:", error);
      return {
        status: statusCode.INTERNAL_SERVER_ERROR,
        success: false,
        message: error.message || resMessage.Server_error
      };
  }
}

exports.updateBatchSize = async (req, res) => {
  try {
    const { batch_size } = req.body;
    const userData = await Project.findOne({ _id: req.params.projectId, userId: req.user._id, tenantId: req.tenant._id }).select('batch_size');
    
    if(!userData) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.USER_NOT_FOUND,
        statusCode: statusCode.BAD_REQUEST
      }
    }

    userData.batch_size = batch_size;
    await userData.save();

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Data_updated,
      statusCode: statusCode.BAD_REQUEST
    }
  } catch (error) {
    console.error("Error in Logout User:", err);
      return {
        status: statusCode.INTERNAL_SERVER_ERROR,
        success: false,
        message: err.message || resMessage.Server_error
      };
  }
}