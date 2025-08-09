const { statusCode, resMessage } = require('../config/constants');
const BusinessProfile = require('../models/BusinessProfile');
const User = require('../models/User');
const Project = require('../models/project');
const Template = require('../models/Template');
const generateToken = require('../utils/generateToken');
const userService = require('../services/userService');
const { sendEmail } = require('../functions/functions');
const BlacklistedTokenSchema = require('../models/BlacklistedTokenSchema');
const { getEmailTemplate } = require('../utils/getEmailTemplate');
const jwt = require('jsonwebtoken');

const registerController = async (req) => {
    try {
        return await userService.register(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
}

const verifyOtpController = async (req) => {
    try {
        return await userService.verifyOtp(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
};

const createBusinessProfileLogic = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;
    const { name, businessAddress, metaAccessToken, metaAppId, metaBusinessId } = req.body;

    if (!name || !metaAccessToken || !metaBusinessId || !metaAppId) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.Missing_required_fields + " (name, metaAccessToken, metaAppId, metaBusinessId required)."
        };
    }

    try {
        const existing = await BusinessProfile.findOne({ tenantId, metaBusinessId });
        if (existing) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: "A business profile with this Meta Business ID already exists in this tenant."
            };
        }

        const newProfile = await BusinessProfile.create({
            userId,
            tenantId,
            name,
            businessAddress,
            metaAccessToken,
            metaAppId,
            metaBusinessId
        });

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Business_profile_created_successfully,
            data: newProfile.toObject()
        };

    } catch (error) {
        if (error.code === 11000) {
            return {
                status: statusCode.CONFLICT,
                success: false,
                message: "Duplicate entry: a profile with this Meta Business ID already exists."
            };
        }

        console.error("Create BusinessProfile error:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

const updateBusinessProfileController = async (req) => {
    try {
        return await userService.updateBusinessProfile(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
};

const getAllBusinessProfilesForUserLogic = async (req) => {
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    try {
        const profiles = await BusinessProfile.find({ userId, tenantId }).lean();
        return {
            status: statusCode.OK,
            success: true,
            message: profiles.length === 0 ? resMessage.Business_profile_not_found : "Fetched successfully",
            data: profiles
        };
    } catch (error) {
        console.error("Get BusinessProfiles error:", error);
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || resMessage.Server_error
        };
    }
};

const deleteBusinessProfile = async (req, res) => {
    const { id: businessProfileId } = req.params;
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    try {
        const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });
        if (!businessProfile) {
            return res.status(statusCode.NOT_FOUND).json({
                success: false,
                message: resMessage.Business_profile_not_found
            });
        }

        const linkedProjectsCount = await Project.countDocuments({ businessProfileId });
        if (linkedProjectsCount > 0) {
            return res.status(statusCode.CONFLICT).json({
                success: false,
                message: `Linked to ${linkedProjectsCount} project(s). Unlink them first.`
            });
        }

        const linkedTemplatesCount = await Template.countDocuments({ businessProfileId });
        if (linkedTemplatesCount > 0) {
            return res.status(statusCode.CONFLICT).json({
                success: false,
                message: `Linked to ${linkedTemplatesCount} template(s). Delete them first.`
            });
        }

        await businessProfile.deleteOne();

        return res.status(statusCode.OK).json({
            success: true,
            message: "Business profile deleted successfully."
        });
    } catch (error) {
        console.error("Delete BusinessProfile error:", error);
        return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || resMessage.Server_error
        });
    }
};

const createBusinessProfile = async (req, res) => {
    const result = await createBusinessProfileLogic(req);
    res.status(result.status).json(result);
};

const updateBusinessProfile = async (req, res) => {
    const result = await updateBusinessProfileLogic(req);
    res.status(result.status).json(result);
};

const getAllBusinessProfilesForUser = async (req, res) => {
    const result = await getAllBusinessProfilesForUserLogic(req);
    res.status(result.status).json(result);
};

const authUser = async (req, res) => {
    const { email, password } = req.body;
    const tenantId = req.tenant._id;

    try {
        const user = await User.findOne({ email, tenantId, isEmailVerified: true });

        if (user && (await user.matchPassword(password))) {
            user.lastLoginAt = new Date();
            await user.save();

            const token = generateToken(user._id, email);

            const subject = 'New Login Detected';
            const text = `Hello ${user.username},\n\n`;

            const html = `
                <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
                    <p>Hello <strong>${user.username}</strong>,</p>
                    <p>A new login was detected to your <strong>Wachat</strong> account.</p>
                    <p>If this was not you, please <a href="https://yourapp.com/reset-password" target="_blank">reset your password</a> immediately.</p>
                    <p><strong>Login time:</strong> ${new Date().toLocaleString()}</p>
                    <br />
                    <p>Regards,<br />Wachat Security Team</p>
                </div>
            `;

            await sendEmail(email, subject, text, getEmailTemplate(html));

            return res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token
            });
        } else {
            return res.status(401).json({ message: 'Invalid email or password for this tenant' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getUserProfile = async (req, res) => {
    if (req.user && req.user.tenantId.toString() === req.tenant._id.toString()) {
        return res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            mobileNumber: req.user.mobileNumber
        });
    } else {
        return res.status(404).json({ message: 'User not found' });
    }
};

const updateUserProfile = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user && user.tenantId.toString() === req.tenant._id.toString()) {
            user.username = username || user.username;
            user.email = email || user.email;
            if (password) user.password = password;

            const updatedUser = await user.save();

            return res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                token: generateToken(updatedUser._id)
            });
        } else {
            return res.status(404).json({ message: 'User not found or not authorized' });
        }
    } catch (error) {
        console.error('Update user error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getAllUsersForTenant = async (req, res) => {
    try {
        const users = await User.find({ tenantId: req.tenant._id }).select('-password');
        const filtered = users.filter(u => u.role !== 'super_admin');
        res.json(filtered);
    } catch (error) {
        console.error('Fetch users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const registerUserByAdmin = async (req, res) => {
    const { username, email, password, role } = req.body;
    const tenantId = req.tenant._id;

    try {
        if (req.user.tenantId.toString() !== tenantId.toString()) {
            return res.status(403).json({ message: 'Unauthorized to create user for this tenant' });
        }

        const exists = await User.findOne({ email, tenantId });
        if (exists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            username,
            email,
            password,
            role: role === 'tenant_admin' ? 'tenant_admin' : 'user',
            tenantId
        });

        return res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error('Admin register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetPasswordController = async (req, res) => {
    try {
        const result = await userService.resetPassword(req);
        res.status(result.statusCode || 500).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

const forgotPasswordController = async (req) => {
  const result = await userService.forgotPassword(req);
  return result; 
};

const updatePasswordWithOtpController = async (req) => {
  const result = await userService.updatePasswordWithOtp(req);
  return result;
};

const updateUserController = async (req) => {
    const result = await userService.updateUser(req);
    return result;
};

const logoutUserController = async (req) => {
    try {
        return await userService.logoutUser(req);
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
        };
    }
}

const resendOtpController = async (req) => {
  try {
    return await userService.resendOtp(req);
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

module.exports = {
    logoutUserController,
    authUser,
    getUserProfile,
    updateUserProfile,
    getAllUsersForTenant,
    registerUserByAdmin,
    createBusinessProfile,
    updateBusinessProfile,
    deleteBusinessProfile,
    getAllBusinessProfilesForUser,
    registerController,
    verifyOtpController,
    resetPasswordController,
    forgotPasswordController,
    updatePasswordWithOtpController,
    updateUserController,
    updateBusinessProfileController,
    resendOtpController
};
