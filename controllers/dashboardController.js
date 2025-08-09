const dashboardService = require('../services/dashboardService');
const { statusCode, resMessage } = require('../config/constants');

/**
 * @desc    Get dashboard statistics for the authenticated user and tenant.
 * @route   GET /api/dashboard/stats
 * @access  Private (User/Team Member)
 */
exports.getDashboardStatsController = async (req) => {
    // userId and tenantId are expected to be available from authentication middleware
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    if (!userId || !tenantId) {
        return {
            status: statusCode.UNAUTHORIZED,
            success: false,
            message: resMessage.Unauthorized_access + " (User or Tenant ID missing)."
        };
    }

    return await dashboardService.getDashboardStats({ userId, tenantId });
};
