const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/auth");
const {responseHandler} = require("../middleware/responseHandler");

const dashboardController = require("../controllers/dashboardController");

router.get("/:projectId/dashboard/stats", protect, authorizeRoles("user"), responseHandler(dashboardController.getDashboardStatsController));

module.exports = router;