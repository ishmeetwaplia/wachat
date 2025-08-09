const Joi = require("joi");

const noHtmlPattern = /^[^<>]*$/;
const noHtmlMessage = 'Field must not contain "<" or ">"';

const baseString = Joi.string().trim().pattern(noHtmlPattern).message(noHtmlMessage);

exports.sendMessage = Joi.object({
  to: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      "string.pattern.base": "Recipient phone number must be a valid numeric string (10-15 digits)",
      "any.required": "Recipient (to) is required",
    }),

  type: Joi.string()
    .valid("text", "image")
    .required()
    .messages({
      "any.only": "Type must be either 'text' or 'image'",
      "any.required": "Message type is required",
    }),

    message: Joi.any()
    .required()
    .messages({
      "any.required": "Message content is required",
    }),
});



