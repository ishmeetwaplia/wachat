const express = require("express");
const { protect } = require("../middleware/auth");
const { responseHandler } = require("../middleware/responseHandler");
const controller = require("../controllers/catalogController");

const router = express.Router();

router.post("/:metaBusinessId", protect, responseHandler(controller.createContactController));
router.get("/:metaBusinessId", protect, responseHandler(controller.catalogListController));
router.get("/sync/:metaBusinessId", protect, responseHandler(controller.syncCatalogsController));

router.post("/:catalogId/product", protect, responseHandler(controller.createProductController));
router.get("/sync/:catalogId/product", protect, responseHandler(controller.syncProductController));

module.exports = router;
