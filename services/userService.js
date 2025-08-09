const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../functions/functions');
// const generateToken = require('../utils/generateToken');
const { statusCode, resMessage } = require('../config/constants');
const BusinessProfile = require('../models/BusinessProfile');

exports.register = async (req) => {     
    const { username, email, password } = req.body;
    const tenantId = req.tenant._id;

    try {
        const existingUser = await User.findOne({ email, tenantId });

        const otp = Array.from({ length: 6 }, () =>
          String.fromCharCode(
            Math.random() < 0.5
              ? 65 + Math.floor(Math.random() * 26)  // A-Z
              : 97 + Math.floor(Math.random() * 26)  // a-z
          )
        ).join('');
        if (existingUser) {
            if (existingUser.isEmailVerified) {
                return {
                    status: statusCode.BAD_REQUEST,
                    success: false,
                    message: resMessage.USER_EXISTS,
                    statusCode: statusCode.BAD_REQUEST
                };
            }

            existingUser.password = password;
            existingUser.otp = otp;
            existingUser.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
            await existingUser.save();

            const subject = 'Wachat Account OTP Verification';
            const text = `Hello ${username},\n\nYour OTP for Wachat is: ${otp}`;
            const html = `
                <h2>Hello ${username},</h2>
                <p>Your OTP for Wachat registration is:</p>
                <h3>${otp}</h3>
                <p>This OTP will expire in 10 minutes.</p>
            `;

            await sendEmail(email, subject, text, html);

            return {
                status: statusCode.OK,
                success: true,
                message: resMessage.OTP_SENT_SUCCESSFULLY_TO_EMAIL,
                data: {
                    _id: existingUser._id,
                    username: existingUser.username,
                    email: existingUser.email,
                    role: existingUser.role,
                    // token: generateToken(existingUser._id)
                },
                statusCode: statusCode.OK
            };
        }

        const user = await User.create({
            tenantId,
            username,
            email,
            password,
            role: 'user',
            otp: otp,
            otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        const subject = 'Wachat Account OTP Verification';
        const text = `Hello ${username},\n\nYour OTP for Wachat is: ${otp}`;
        const html = `
            <h2>Hello ${username},</h2>
            <p>Your OTP for Wachat registration is:</p>
            <h3>${otp}</h3>
            <p>This OTP will expire in 5 minutes.</p>
        `;

        await sendEmail(email, subject, text, html);

        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.OTP_SENT_SUCCESSFULLY_TO_EMAIL,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                // token: generateToken(user._id)
            },
            statusCode: statusCode.CREATED
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};

exports.verifyOtp = async (req) => {
  try {
    const { email, otp } = req.body;

    const userd = await User.findOne({ email, isEmailVerified: true });
    if (userd) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Email_already_registered,
        statusCode: statusCode.NOT_FOUND
      };
    }

    const user = await User.findOne({ email, isEmailVerified: false });
    if (user) {
      if (user.otp !== otp) {
        return {
          status: statusCode.UNAUTHORIZED,
          success: false,
          message: resMessage.Invalid_otp,
          statusCode: statusCode.UNAUTHORIZED
        };
      }

      if (!user.otpExpiresAt || Date.now() > user.otpExpiresAt) {
        return {
          status: statusCode.UNAUTHORIZED,
          success: false,
          message: resMessage.Otp_expired,
          statusCode: statusCode.UNAUTHORIZED
        };
      }

      if (user.otp !== otp) {
        return {
          status: statusCode.UNAUTHORIZED,
          success: false,
          message: resMessage.Invalid_otp,
          statusCode: statusCode.UNAUTHORIZED
        };
      }

      user.otp = null;
      user.otpExpiresAt = null;
      user.isEmailVerified = true;
      await user.save();

      return {
        id: user._id,
        status: statusCode.OK,
        success: true,
        message: resMessage.otp_verified_successfully,
        statusCode: statusCode.OK
      };
    }

  } catch (err) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: err.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

exports.resetPassword = async (req) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user._id;
        const tenantId = req.tenant._id;

        if (!oldPassword || !newPassword) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.MISSING_FIELDS || 'Old and new passwords are required.',
                statusCode: statusCode.BAD_REQUEST
            };
        }

        const user = await User.findOne({ _id: userId, tenantId });

        if (!user) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.USER_NOT_FOUND || 'User not found.',
                statusCode: statusCode.NOT_FOUND
            };
        }

        const isMatch = await user.matchPassword(oldPassword);

        if (!isMatch) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.INVALID_OLD_PASSWORD || 'Old password is incorrect.',
                statusCode: statusCode.BAD_REQUEST
            };
        }

        user.password = newPassword;
        user.passwordChangedAt = new Date();
        user.token = "";
        await user.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.PASSWORD_UPDATED_SUCCESSFULLY || 'Password updated successfully.',
            statusCode: statusCode.OK
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message,
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};

exports.forgotPassword = async (req) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.EMAIL_NOT_FOUND || 'Email not registered',
        statusCode: statusCode.NOT_FOUND
      };
    }

    const otp = Array.from({ length: 6 }, () =>
      String.fromCharCode(
        Math.random() < 0.5
          ? 65 + Math.floor(Math.random() * 26)
          : 97 + Math.floor(Math.random() * 26)
      )
    ).join('');


    user.otp = otp;
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await user.save();

    const subject = 'Wachat Password Reset OTP';
    const text = `Hello ${user.username},\n\nYour OTP to reset your password is: ${otp}`;
    const html = `
      <h2>Hello ${user.username},</h2>
      <p>Your OTP to reset your password is:</p>
      <h3>${otp}</h3>
      <p>This OTP will expire after 10 min. Please use it promptly.</p>
    `;

    await sendEmail(email, subject, text, html);

    return {
      status: statusCode.OK,
      success: true,
      message: 'OTP sent successfully to email',
      statusCode: statusCode.OK
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

exports.updatePasswordWithOtp = async (req) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: 'User not found',
        statusCode: statusCode.NOT_FOUND
      };
    }

    if (user.otp !== otp) {
      return {
        status: statusCode.UNAUTHORIZED,
        success: false,
        message: 'Invalid OTP',
        statusCode: statusCode.UNAUTHORIZED
      };
    }

    user.password = newPassword;
    user.otp = null;
    await user.save();

    return {
      status: statusCode.OK,
      success: true,
      message: 'Password updated successfully',
      statusCode: statusCode.OK
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};

exports.updateUser = async (req) => {
    try {
        console.log("🔐 [updateUser] Called");

        const paramUserId = req.params.userId;
        const tokenUserId = req.user._id.toString();
        const tenantId = req.tenant._id;

        const {
            email,
            username,
            firstName,
            lastName,
            mobileNumber
        } = req.body;

        // Step 1: Check user ID matches token user
        if (paramUserId !== tokenUserId) {
            return {
                status: statusCode.UNAUTHORIZED,
                success: false,
                message: 'Unauthorized: You can only update your own profile.',
                statusCode: statusCode.UNAUTHORIZED
            };
        }

        // Step 2: Email is required to match before update
        if (!email) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: 'Email is required to update your profile.',
                statusCode: statusCode.BAD_REQUEST
            };
        }

        // Step 3: Find user using ID, tenant, and email for verification
        const user = await User.findOne({ _id: paramUserId, tenantId });

        if (!user || user.email !== email) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: 'User not found or email does not match.',
                statusCode: statusCode.NOT_FOUND
            };
        }

        // Step 4: Only update allowed fields
        if (username !== undefined) user.username = username;
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;

        await user.save();

        return {
            status: statusCode.OK,
            success: true,
            message: 'User profile updated successfully.',
            data: {
                _id: user._id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                mobileNumber: user.mobileNumber,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            },
            statusCode: statusCode.OK
        };
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message || 'Internal server error',
            statusCode: statusCode.INTERNAL_SERVER_ERROR
        };
    }
};

exports.updateBusinessProfile = async (req) => {
  const businessProfileId = req.params.id;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const { name, businessAddress, metaAccessToken, metaAppId } = req.body;

  try {
    const businessProfile = await BusinessProfile.findOne({ _id: businessProfileId, userId, tenantId });

    if (!businessProfile) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Business_profile_not_found
      };
    }

    if (name && name !== businessProfile.name) {
      const conflict = await BusinessProfile.findOne({
        name,
        tenantId,
        _id: { $ne: businessProfileId }
      });

      if (conflict) {
        return {
          status: statusCode.CONFLICT,
          success: false,
          message: "Another business profile with this name already exists."
        };
      }
    }

    Object.assign(businessProfile, {
      name: name ?? businessProfile.name,
      businessAddress: businessAddress ?? businessProfile.businessAddress,
      metaAccessToken: metaAccessToken ?? businessProfile.metaAccessToken,
      metaAppId: metaAppId ?? businessProfile.metaAppId
      // No metaBusinessId update
    });

    await businessProfile.save();

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Business_profile_updated_successfully,
      data: businessProfile.toObject()
    };
  } catch (error) {
    console.error("Update BusinessProfile error:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error
    };
  }
};

exports.logoutUser = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Token_is_required,
        statusCode: statusCode.BAD_REQUEST
      }
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
          return {
            status: statusCode.NOT_FOUND,
            success: false,
            message: resMessage.USER_NOT_FOUND,
            statusCode: statusCode.NOT_FOUND
          }
        }

        user.passwordChangedAt = new Date();
        user.token = "";
        await user.save();

        return {
            status: statusCode.OK,
            success: true,
            message: resMessage.Logged_out_successfully,
            statusCode: statusCode.OK
        };
    } catch (err) {
      console.error("Error in Logout User:", err);
      return {
        status: statusCode.INTERNAL_SERVER_ERROR,
        success: false,
        message: err.message || resMessage.Server_error
      };
    }
};

exports.resendOtp = async (req) => {
  const { email, type } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.EMAIL_NOT_FOUND || 'User not found',
        statusCode: statusCode.NOT_FOUND
      };
    }

    if (type === 'register') {
      if (user.isEmailVerified) {
        return {
          status: statusCode.BAD_REQUEST,
          success: false,
          message: resMessage.Email_already_registered || 'Email already verified',
          statusCode: statusCode.BAD_REQUEST
        };
      }
    }

    if (type === 'forgot_password') {
      if (!user.isEmailVerified) {
        return {
          status: statusCode.BAD_REQUEST,
          success: false,
          message: 'Email is not verified. Cannot proceed with password reset.',
          statusCode: statusCode.BAD_REQUEST
        };
      }
    }

    const otp = Array.from({ length: 6 }, () =>
      String.fromCharCode(
        Math.random() < 0.5
          ? 65 + Math.floor(Math.random() * 26)  // A-Z
          : 97 + Math.floor(Math.random() * 26)  // a-z
      )
    ).join('');

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp: otp,
          otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        }
      }
    );

    const subject = type === 'register'
      ? 'Wachat Registration OTP'
      : 'Wachat Password Reset OTP';

    const html = `
      <h2>Hello ${user.username || 'User'},</h2>
      <p>Your OTP for Wachat ${type === 'register' ? 'registration' : 'password reset'} is:</p>
      <h3>${otp}</h3>
      <p>This OTP will expire in 10 minutes.</p>
    `;

    const text = `Hello ${user.username || 'User'},\n\nYour OTP is: ${otp}`;

    await sendEmail(email, subject, text, html);

    return {
      status: statusCode.OK,
      success: true,
      message: 'OTP resent successfully',
      statusCode: statusCode.OK
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR
    };
  }
};
