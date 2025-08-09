// server/controllers/dashboardController.js
const dashboardService = require('../services/projectDashboardService');
const { statusCode, resMessage } = require('../config/constants');

/**
 * @desc    Get dashboard statistics for a specific project, user, and tenant.
 * @route   GET /api/projects/:projectId/dashboard/stats
 * @access  Private (User/Team Member)
 */
exports.getDashboardStatsController = async (req) => {
    const  projectId = req.params.projectId // Get projectId from URL parameters
    const userId = req.user._id;
    const tenantId = req.tenant._id;

    if (!userId || !tenantId || !projectId) { // projectId is now required
        return {
            status: statusCode.BAD_REQUEST, // Changed from UNAUTHORIZED if projectId is missing
            success: false,
            message: resMessage.Missing_required_fields + " (User ID, Tenant ID, or Project ID missing)."
        };
    }

    return await dashboardService.getProjectDashboardStats({ userId, tenantId, projectId });
};
