const whatsappService = require('../services/whatsappService');
const { statusCode, resMessage } = require('../config/constants');

// @desc    Get WhatsApp phone numbers from Meta API using provided credentials
// @route   POST /api/whatsapp/phone-numbers
// @access  Private (user must be authenticated)
exports.getPhoneNumbersController = async (req) => {
    const { wabaId, accessToken } = req.body; // Expect WABA ID and Access Token in body

    if (!wabaId || !accessToken) {
        return {
            status: statusCode.BAD_REQUEST,
            success: false,
            message: resMessage.WABA_ID_and_ACCESS_TOKEN_REQUIRED
        };
    }

    // Call the service with provided credentials
    return await whatsappService.getPhoneNumbersFromMeta({
        wabaId,
        accessToken,
        facebookUrl: req.tenant.metaApi?.facebookUrl, // Optionally use tenant's default Facebook URL/Graph Version
        graphVersion: req.tenant.metaApi?.graphVersion,
    });
};
