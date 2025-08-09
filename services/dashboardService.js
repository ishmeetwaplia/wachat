// server/services/dashboardService.js
const Contact = require('../models/Contact');
const Group = require('../models/Group');
const Template = require('../models/Template');
const BulkSendJob = require('../models/BulkSendJob');
const Message = require('../models/Message');
const User = require('../models/User');
const { statusCode, resMessage } = require('../config/constants');
const Conversation = require("../models/ConversationSchema");

const calculateWeeklyChange = async (Model, query, dateField, days = 7) => {
    const now = new Date();
    const currentPeriodStart = new Date(now.setDate(now.getDate() - days));
    const previousPeriodStart = new Date(new Date().setDate(new Date().getDate() - (2 * days)));

    const currentPeriodCount = await Model.countDocuments({
        ...query,
        [dateField]: { $gte: currentPeriodStart }
    });

    const previousPeriodCount = await Model.countDocuments({
        ...query,
        [dateField]: { $gte: previousPeriodStart, $lt: currentPeriodStart }
    });

    let percentageChange = 0;
    if (previousPeriodCount > 0) {
        percentageChange = ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100;
    } else if (currentPeriodCount > 0) {
        percentageChange = 100;
    }

    return { currentPeriodCount, previousPeriodCount, percentageChange };
};

exports.getDashboardStats = async ({ userId, tenantId }) => {
    try {
        const baseQuery = { tenantId, userId };

        const totalContacts = await Contact.countDocuments(baseQuery);
        const { currentPeriodCount: newContactsThisWeek, percentageChange: newContactsPercentageChange } = await calculateWeeklyChange(Contact, baseQuery, 'createdAt', 7);

        const totalGroups = await Group.countDocuments(baseQuery);
        const activeGroupsCount = await Group.countDocuments({
            ...baseQuery,
            isActive: true
        });
        const inactiveGroupsCount = await Group.countDocuments({
            ...baseQuery,
            isActive: false
        });

        const totalTemplates = await Template.countDocuments(baseQuery);
        const approvedTemplates = await Template.countDocuments({ ...baseQuery, metaStatus: 'APPROVED' });
        const pendingTemplates = await Template.countDocuments({
            ...baseQuery,
            metaStatus: { $in: ['PENDING', 'LOCAL_DRAFT', 'PENDING_UPDATE'] }
        });

        const totalBroadcasts = await BulkSendJob.countDocuments(baseQuery);
        const successfulBroadcasts = await BulkSendJob.aggregate([
            { $match: baseQuery },
            { $group: { _id: null, totalSent: { $sum: '$totalSent' } } }
        ]);
        const failedBroadcasts = await BulkSendJob.aggregate([
            { $match: baseQuery },
            { $group: { _id: null, totalFailed: { $sum: '$totalFailed' } } }
        ]);
        const scheduledBroadcasts = await BulkSendJob.countDocuments({ ...baseQuery, status: 'pending' });

        const totalSentMessages = successfulBroadcasts.length > 0 ? successfulBroadcasts[0].totalSent : 0;
        const totalFailedMessages = failedBroadcasts.length > 0 ? failedBroadcasts[0].totalFailed : 0;

        const totalTeamMembers = await User.countDocuments({ tenantId })
        const adminMembers = await User.countDocuments({ tenantId, role: 'admin' });
        const regularMembers = totalTeamMembers - adminMembers;

        const unreadCount = await Conversation.aggregate([
        {
            $match: {
                ...baseQuery
            }
        },
        {
            $group: {
                _id: "unread_message",
                unreadCount: {
                    $sum: "$unreadCount"
                }
            }
        }
        ]);

        const totalUnread = unreadCount.length > 0 ? unreadCount[0].unreadCount : 0;

        const twentyFourHoursAgo = new Date(new Date().setHours(new Date().getHours() - 24));
        const recentInboundMessages = await Message.countDocuments({
            ...baseQuery,
            direction: 'inbound',
            createdAt: { $gte: twentyFourHoursAgo }
        });
        const recentOutboundMessages = await Message.countDocuments({
            ...baseQuery,
            direction: 'outbound',
            createdAt: { $gte: twentyFourHoursAgo }
        });

        let responseRate = 0;
        if (recentInboundMessages > 0) {
            responseRate = (recentOutboundMessages / recentInboundMessages) * 100;
            if (responseRate > 100) responseRate = 100;
        }
        const responseRateChangeVsLastWeek = 0;

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
            },
            teamMembers: {
                total: totalTeamMembers,
                admins: adminMembers,
                members: regularMembers,
            },
            liveChat: {
                unread: totalUnread,
                responseRate: parseFloat(responseRate.toFixed(1)),
                responseRateChangeVsLastWeek: parseFloat(responseRateChangeVsLastWeek.toFixed(1)),
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
