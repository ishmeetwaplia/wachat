const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 120 * 1000, 
  max: 10,
  keyGenerator: (req) => {
    try {
      return req.body?.email || ipKeyGenerator(req);
    } catch (err) {
      return ipKeyGenerator(req); 
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json({
      status: options.statusCode,
      success: false,
      message: 'Too many login attempts for this account. Try again in a minute.',
    });
  }
});

const sendGroupMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => {
    return req.body.groupId || ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json({
      status: options.statusCode,
      success: false,
      message: 'Too many login attempts for this account. Try again in a minute.',
    });
  }
});

const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 10 minutes
  max: 5, // allow max 5 OTP actions (send/verify) per 10 minutes per email
  keyGenerator: (req) => {
    return req.body.email || ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json({
      status: options.statusCode,
      success: false,
      message: 'Too many OTP attempts. Please try again after 10 minutes.',
    });
  }
});


module.exports = {
  loginLimiter,
  sendGroupMessageLimiter,
  otpLimiter
}