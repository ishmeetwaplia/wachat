const Joi = require("joi");

const titleValidation = Joi.string()
  .trim()
  .pattern(/^[^<>]*$/, "no angle brackets")
  .messages({
    "string.pattern.name": "Group title must not contain '<' or '>'",
    "string.empty": "Group title cannot be empty",
    "any.required": "Group title is required",
  });

const createGroup = Joi.object({
  title: Joi.string()
    .trim()
    .pattern(/^(?!.*  )[a-zA-Z0-9_ ]+$/)
    .min(3)
    .optional()
    .messages({
      "string.pattern.base": "Title can only contain letters, numbers, underscores, and single spaces between words",
      "string.base": "Title must be a string",
      "string.min": "Title must be at least 3 characters long",
    }),
  description: Joi.string().trim().allow('', null).optional().messages({
    "string.base": "Description must be a string",
  })
});

const updateGroup = Joi.object({
  title: Joi.string()
    .trim()
    .pattern(/^(?!.*  )[a-zA-Z0-9_ ]+$/)
    .min(3)
    .optional()
    .messages({
      "string.pattern.base": "Title can only contain letters, numbers, underscores, and single spaces between words",
      "string.base": "Title must be a string",
      "string.min": "Title must be at least 3 characters long",
    }),
  description: Joi.string().trim().allow('', null).optional().messages({
    "string.base": "Description must be a string",
  })
});

const multiArchiveUpdate = Joi.object({
  ids: Joi.array()
    .items(
      Joi.string().hex().length(24).messages({
        "string.hex": "Each group ID must be a valid hex string",
        "string.length": "Each group ID must be 24 characters long",
      })
    )
    .required()
    .messages({
      "array.base": "ids must be an array of group IDs",
      "any.required": "ids field is required",
    }),
});

module.exports = {
  createGroup,
  updateGroup,
  multiArchiveUpdate,
};