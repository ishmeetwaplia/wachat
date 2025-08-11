const { statusCode, resMessage } = require("../config/constants");
const { getBusinessData, createProductCatalog, getOwnedProductCatalogs } = require('../functions/functions');
const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');

exports.create = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const { accessToken } = req.query;
        const { name } = req.body;
        const isMetaId = await Businessprofile.findOne({ metaId: metaBusinessId });
        if(!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            }
        }
        const checkMetaId = await getBusinessData(metaBusinessId, accessToken);
        if(checkMetaId?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: checkMetaId?.error?.message
            }
        }
        const existingCatalog = await Catalog.findOne({ metaId: checkMetaId.id });
        if (existingCatalog && !existingCatalog.userId.equals(req.user._id)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_already_linked
            }
        }
        const catalogData = await createProductCatalog(metaBusinessId, name, accessToken);
        if(catalogData?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: catalogData?.error?.message
            }
        }
        isMetaId.businessIdAccessToken = accessToken;
        await isMetaId.save();
        await Catalog.create({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: isMetaId.metaId,
            catalogId: catalogData.id,
            metaId: checkMetaId.id,
            name,
            accessToken
        })
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Catalog_created
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}

exports.syncCatalogs = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const exitingData = await Businessprofile.findOne({ metaId: metaBusinessId });
        if (!exitingData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            };
        }
        const catalogs = await getOwnedProductCatalogs(metaBusinessId, exitingData.businessIdAccessToken);

        if (catalogs?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: catalogs?.error?.message
            };
        }


        const catalogDocs = catalogs?.data.map(item => ({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: exitingData.metaBusinessId,
            metaId: metaBusinessId,
            catalogId: item.id,
            name: item.name || "Untitled Catalog"
        })) || [];

        if (catalogDocs.length === 0) {
            return {
                status: statusCode.SUCCESS,
                success: true,
                message: "No catalogs found from Meta API"
            };
        }

        const existingIds = await Catalog.find({
            catalogId: { $in: catalogDocs.map(c => c.catalogId) },
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: exitingData.metaBusinessId,
            metaId: metaBusinessId
        }).distinct("catalogId");

        const newCatalogs = catalogDocs.filter(c => !existingIds.includes(c.catalogId));

        if (newCatalogs.length > 0) {
            await Catalog.insertMany(newCatalogs);
        }

        return {
            status: statusCode.SUCCESS,
            success: true,
            message: resMessage.Catalogs_sync_successfully,
            newCatalogsAdded: newCatalogs.length
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
};

exports.catalogList = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const data = await Catalog.find({ metaId: metaBusinessId, userId: req.user._id, tenantId: req.tenant._id });
        if(!data) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            }
        }
        return {
            data,
            status: statusCode.OK,
            success: true,
            message: resMessage.Data_fetch_successfully
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}