const Joi = require('joi');

exports.createProjectSchema = Joi.object({
    activePlan: Joi.string().required(),
    assistantName: Joi.string().allow(''),
    businessProfileId: Joi.string().required(),
    description: Joi.string().required(),
    isWhatsappVerified: Joi.boolean().required(),
    metaPhoneNumberID: Joi.string().required(),
    name: Joi.string().required(),
    planDuration: Joi.number().allow(null).required(),
    whatsappNumber: Joi.string().required(),

    about: Joi.string().allow('').optional(),
    address: Joi.string().allow('').optional(),
    email: Joi.string().email().allow('').optional(),
    websites: Joi.array().items(Joi.string().uri()).allow(null).optional(),
    vertical: Joi.string().allow('').optional(),
    profilePictureUrl: Joi.string().uri().allow('').optional(),
});

exports.updateBatchSize = Joi.object({
  batch_size: Joi.number().optional().messages({
    'number.base': 'Batch size must be a number',
  }),
});