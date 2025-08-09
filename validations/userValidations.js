const Joi = require("joi");

exports.register = Joi.object({
  username: Joi.string()
  .trim()
  .pattern(/^[a-zA-z0-9_]+$/)
  .required()
   .messages({
    "any.required": "Username is required",
    "string.pattern.base": "Username can only contain letters, numbers, and underscores",
  }),
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string()
    .trim()
    .min(6)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d])[A-Za-z\\d\\W_]+$"))
    .required()
    .messages({
      "any.required": "Password is required",
      "string.min": "Password must be at least 6 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
  });

exports.login = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: Joi.string().trim().required().messages({
    "any.required": "Password is required",
  }),
});

exports.update = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "any.required": "Email is required",
      "string.email": "Please provide a valid email",
    }),

  username:  Joi.string()
    .trim()
    .pattern(/^[^<>]*$/)
    .optional()
    .messages({
      "string.pattern.base": "Username must not contain '<' or '>' characters",
    }),

  firstName: Joi.string()
    .trim()
    .optional(),

  lastName: Joi.string()
    .trim()
    .optional(),

  mobileNumber: Joi.string()
    .trim()
    .min(10)
    .max(13)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      "string.min": "Mobile number must be at least 10 digits",
      "string.max": "Mobile number must not exceed 13 digits",
      "string.pattern.base": "Mobile number must be numeric",
    }),

  profilePicture: Joi.string()
    .trim()
    .uri()
    .allow(null, '') 
    .optional()
    .messages({
      "string.uri": "Profile picture must be a valid URI",
    }),

  gender: Joi.string()
    .valid("male", "female", "other")
    .optional()
    .messages({
      "any.only": "Gender must be one of: male, female, other",
    }),

  dob: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format": "Date of birth must be in ISO format (YYYY-MM-DD)",
    }),
});

exports.forgotPassword = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
});

exports.resetPassword = Joi.object({
  oldPassword: Joi.string()
    .trim()
    .required()
    .messages({
      "any.required": "Old password is required",
    }),

  newPassword: Joi.string()
    .trim()
    .min(6)
    .required()
    .messages({
      "any.required": "New password is required",
      "string.min": "Password must be at least 6 characters long",
    }),
});

exports.resetPasswordWithOtp = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "any.required": "Email is required",
      "string.email": "Please provide a valid email",
    }),

  otp: Joi.string()
    .trim()
    .length(6)
    .pattern(/^[A-Za-z]{6}$/)
    .required()
    .messages({
      "any.required": "OTP is required",
      "string.length": "OTP must be 6 characters",
      "string.pattern.base": "OTP must contain only letters (A-Z, a-z)",
    }),

  newPassword: Joi.string()
    .trim()
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{6,}$"
      )
    )
    .required()
    .messages({
      "any.required": "New password is required",
      "string.pattern.base":
        "Password must be at least 6 characters and include uppercase, lowercase, number, and special character",
  }),
});

exports.verifyOtp = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  otp: Joi.string()
    .trim()
    .length(6)
    .pattern(/^[A-Za-z]{6}$/)
    .required()
    .messages({
      "any.required": "OTP is required",
      "string.length": "OTP must be 6 characters",
      "string.pattern.base": "OTP must contain only letters (A-Z, a-z)",
    }),
});

exports.resendOtp = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "any.required": "Email is required",
      "string.email": "Please provide a valid email",
    }),

  type: Joi.string()
    .valid("register", "forgot_password")
    .required()
    .messages({
      "any.required": "Type is required",
      "any.only": "Type must be either 'register' or 'forgot_password'",
    }),
});

exports.updateBatchSize = Joi.object({
  batch_size: Joi.number().optional().messages({
    'number.base': 'Batch size must be a number',
  }),
});
