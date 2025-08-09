const Joi = require("joi");

const baseContactSchema = {
  name: Joi.string()
  .trim()
  .pattern(/^[a-zA-Z0-9_ ]+$/) 
  .messages({
    "string.pattern.base": "Name can only contain letters, numbers, underscores, and spaces",
    "string.base": "Name must be a string",
  }),
  email: Joi.string().email().trim().lowercase().allow('', null),
  countryCode: Joi.string().trim().allow('', null),
  mobileNumber: Joi.string()
  .trim()
  .pattern(/^[0-9]{12,14}$/)
  .required()
  .messages({
    "any.required": "Mobile number is required",
    "string.pattern.base": "Mobile number must be between 12 to 14 digits and contain only numbers",
  }),
  whatsappId: Joi.string().trim().pattern(/^[0-9]+$/).allow('', null),
  profileName: Joi.string().trim().allow('', null),
  isBlocked: Joi.boolean(),
  groupIds: Joi.array()
  .items(
    Joi.string()
      .hex()
      .length(24)
      .messages({
        "string.length": "Each group ID must be 24 characters long",
        "string.hex": "Each group ID must be a valid hex string",
      })
  )
  .min(1)
  .required()
  .messages({
    "any.required": "Group IDs are required",
    "array.base": "Group IDs must be an array",
    "array.min": "At least one group ID is required",
  }),
  tags: Joi.array().items(Joi.string()),
};

// POST schema (create contact)
exports.create = Joi.object({
  ...baseContactSchema,
}).unknown(true); // ✅ Allow unknown fields in request body

// PUT schema (update contact)
exports.update = Joi.object({
  ...baseContactSchema,
}).unknown(true); // ✅ Allow unknown fields in request body

// 2. Remove from blocklist
exports.removeBlackListContact = Joi.object({
  contactId: Joi.string().hex().length(24).required().messages({
    "any.required": "Contact ID is required",
    "string.hex": "Invalid Contact ID format",
    "string.length": "Contact ID must be 24 characters long"
  })
});

// 3. Bulk contact delete
exports.bulkDeleteContacts = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required().messages({
    "any.required": "IDs array is required",
    "array.min": "At least one ID must be provided",
    "string.hex": "Invalid ID format"
  })
});

// 4. Bulk block/unblock
exports.bulkBlockUnblock = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required().messages({
    "any.required": "IDs array is required",
    "array.min": "At least one ID must be provided",
    "string.hex": "Invalid ID format"
  })
});

// ✅ 5. Upload contact validation — allow random fields
exports.uploadContact = Joi.object({
  mapping: Joi.string().required().messages({
    "any.required": "Field mapping is required",
  }),
  groupName: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional()
}).unknown(true); // ✅ Allow unknown fields

// 6. Add custom field to contacts
exports.addCustomField = Joi.object({
  key: Joi.string().trim().required().messages({
    "any.required": "Field key is required",
    "string.empty": "Field key cannot be empty",
  }),
  type: Joi.string().valid("text", "number", "date", "boolean", "enum").required().messages({
    "any.required": "Field type is required",
    "any.only": "Type must be one of: text, number, date, boolean, enum"
  })
});
