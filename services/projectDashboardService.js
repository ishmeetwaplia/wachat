// server/services/dashboardService.js
const Contact = require("../models/Contact");
const Group = require("../models/Group");
const Template = require("../models/Template");
const BulkSendJob = require("../models/BulkSendJob");
const Message = require("../models/Message");
const User = require("../models/User"); // Assuming User model for team members
const { statusCode, resMessage } = require("../config/constants");
const mongoose = require("mongoose");

/**
 * Calculates the number of items created in the last N days compared to the N days before that.
 * @param {mongoose.Model} Model - The Mongoose model to query.
 * @param {Object} query - Base query to filter documents (e.g., { tenantId, userId, projectId }).
 * @param {string} dateField - The name of the date field to use (e.g., 'createdAt').
 * @param {number} days - The number of days for the current period (e.g., 7 for this week).
 * @returns {Object} { currentPeriodCount, previousPeriodCount, percentageChange }
 */
const calculateWeeklyChange = async (Model, query, dateField, days = 7) => {
  const now = new Date();
  const currentPeriodStart = new Date(now.setDate(now.getDate() - days));
  const previousPeriodStart = new Date(
    new Date().setDate(new Date().getDate() - 2 * days)
  );

  const currentPeriodCount = await Model.countDocuments({
    ...query,
    [dateField]: { $gte: currentPeriodStart },
  });

  const previousPeriodCount = await Model.countDocuments({
    ...query,
    [dateField]: { $gte: previousPeriodStart, $lt: currentPeriodStart },
  });

  let percentageChange = 0;
  if (previousPeriodCount > 0) {
    percentageChange =
      ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100;
  } else if (currentPeriodCount > 0) {
    percentageChange = 100; // If previous was 0 and current is > 0, it's a 100% increase
  }

  return { currentPeriodCount, previousPeriodCount, percentageChange };
};

/**
 * @desc    Fetches aggregated dashboard statistics for a given user, tenant, and project.
 * @param {Object} options - Options for fetching stats.
 * @param {string} options.userId - The ID of the authenticated user.
 * @param {string} options.tenantId - The ID of the tenant.
 * @param {string} options.projectId - The ID of the specific project.
 * @returns {Object} Success status and dashboard data.
 */
exports.getProjectDashboardStats = async ({ userId, tenantId, projectId }) => {
  try {
    // Base query for project-specific data
    const projectSpecificQuery = { tenantId, userId, projectId };
    console.log("Project-specific query:", projectSpecificQuery);
    const projectspecifyfortheaggregation = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
      projectId: new mongoose.Types.ObjectId(projectId),
    };
    // Base query for tenant-wide data (e.g., Team Members)
    //     tenantId: new mongoose.Types.ObjectId("685a4c632a36a49fac5ab710"),
    //   userId: new mongoose.Types.ObjectId("685a51675eb65f3c2cd9acb6"),
    //   projectId: new mongoose.Types.ObjectId("686b7112dd16c62f0b63105e")
    const tenantWideQuery = { tenantId };

    // --- Contacts Statistics (Project-specific) ---
    const totalContacts = await Contact.countDocuments(projectSpecificQuery);
    const {
      currentPeriodCount: newContactsThisWeek,
      percentageChange: newContactsPercentageChange,
    } = await calculateWeeklyChange(
      Contact,
      projectSpecificQuery,
      "createdAt",
      7
    );

    // --- Groups Statistics (Project-specific) ---
    const totalGroups = await Group.countDocuments(projectSpecificQuery);
    const thirtyDaysAgo = new Date(
      new Date().setDate(new Date().getDate() - 30)
    );
    const activeGroupsCount = await Group.countDocuments({
      ...projectSpecificQuery,
      lastActivityAt: { $gte: thirtyDaysAgo }, // Requires a 'lastActivityAt' field in Group model
    });
    const inactiveGroupsCount = totalGroups - activeGroupsCount;

    // --- Templates Statistics (Project-specific) ---
    // Assuming templates are linked to business profiles, and business profiles to projects.
    // For simplicity here, we'll assume templates can be directly linked to a project for dashboard purposes.
    // If templates are only linked to BusinessProfile, you'd need to fetch the project's BusinessProfileId first.
    const totalTemplates = await Template.countDocuments(projectSpecificQuery);
    const approvedTemplates = await Template.countDocuments({
      ...projectSpecificQuery,
      metaStatus: "APPROVED",
    });
    const pendingTemplates = await Template.countDocuments({
      ...projectSpecificQuery,
      metaStatus: { $in: ["PENDING", "LOCAL_DRAFT", "PENDING_UPDATE"] },
    });

    // --- Broadcasting Statistics (BulkSendJob - Project-specific) ---
    const totalBroadcasts = await BulkSendJob.countDocuments(
      projectSpecificQuery
    );
    const successfulBroadcasts = await BulkSendJob.aggregate([
      { $match: projectspecifyfortheaggregation },
      { $group: { _id: null, totalSent: { $sum: "$totalSent" } } },
    ]);
    const failedBroadcasts = await BulkSendJob.aggregate([
      { $match: projectspecifyfortheaggregation },
      { $group: { _id: null, totalFailed: { $sum: "$totalFailed" } } },
    ]);
    const totalcontact = await BulkSendJob.aggregate([
      { $match: projectspecifyfortheaggregation },
      { $group: { _id: null, totalContacts: { $sum: "$totalContacts" } } },
    ]);
    const scheduledBroadcasts = await BulkSendJob.countDocuments({
      ...projectspecifyfortheaggregation,
      status: "pending",
    });

    const totalSentMessages =
      successfulBroadcasts.length > 0 ? successfulBroadcasts[0].totalSent : 0;
    const totalFailedMessages =
      failedBroadcasts.length > 0 ? failedBroadcasts[0].totalFailed : 0;
    const totalcontactMessages =
      totalcontact.length > 0 ? totalcontact[0].totalContacts : 0;

    // --- Team Members Statistics (Tenant-wide) ---
    const totalTeamMembers = await User.countDocuments(tenantWideQuery); // All users in the tenant
    const adminMembers = await User.countDocuments({
      ...tenantWideQuery,
      role: "admin",
    }); // Assuming 'admin' role
    const regularMembers = totalTeamMembers - adminMembers; // Assuming others are 'members'

    // --- Live Chat Statistics (Messages - Project-specific) ---
    const unreadMessages = await Message.countDocuments({
      ...projectSpecificQuery,
      direction: "inbound",
      // status: 'delivered', // Inbound messages not yet 'read' by agent
    });
    const activeChatUsers = await Message.distinct("from", {
      ...projectSpecificQuery,
      direction: "inbound",
    });

    const activeUserCount = activeChatUsers.length;
    const twentyFourHoursAgo = new Date(
      new Date().setHours(new Date().getHours() - 24)
    );
    const recentInboundMessages = await Message.countDocuments({
      ...projectSpecificQuery,
      direction: "inbound",
      createdAt: { $gte: twentyFourHoursAgo },
    });
    const recentOutboundMessages = await Message.countDocuments({
      ...projectSpecificQuery,
      direction: "outbound",
      createdAt: { $gte: twentyFourHoursAgo },
    });

    let responseRate = 0;
    if (recentInboundMessages > 0) {
      responseRate = (recentOutboundMessages / recentInboundMessages) * 100;
      if (responseRate > 100) responseRate = 100;
    }
    const responseRateChangeVsLastWeek = 0; // Placeholder for more complex calculation

    // --- Assemble Dashboard Data ---
    const dashboardData = {
      contacts: {
        total: totalContacts,
        newThisWeek: newContactsThisWeek,
        changeVsLastWeek: parseFloat(newContactsPercentageChange.toFixed(1)),
      },
      groups: {
        total: totalGroups,
        active: activeGroupsCount,
        inactive: inactiveGroupsCount,
      },
      templates: {
        total: totalTemplates,
        approved: approvedTemplates,
        pending: pendingTemplates,
      },
      broadcasting: {
        totalJobs: totalBroadcasts,
        success: totalSentMessages,
        failed: totalFailedMessages,
        scheduled: scheduledBroadcasts,
        totalcontact: totalcontactMessages, // Handle case where aggregation returns empty
      },
      teamMembers: {
        // This remains tenant-wide
        total: totalTeamMembers,
        admins: adminMembers,
        members: regularMembers,
      },
      liveChat: {
        unread: unreadMessages,
        responseRate: parseFloat(responseRate.toFixed(1)),
        responseRateChangeVsLastWeek: parseFloat(
          responseRateChangeVsLastWeek.toFixed(1)
        ),
        activeUserCount: activeUserCount, // Count of unique users who sent messages in the last 24 hours
      },
    };

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Dashboard_stats_fetched_successfully,
      data: dashboardData,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};
