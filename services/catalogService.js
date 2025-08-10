const { statusCode, resMessage } = require("../config/constants");
const { getBusinessData, createProductCatalog } = require('../functions/functions');
const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');

exports.create = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const { accessToken } = req.query;
        const { name, businessProfileId } = req.body;
        const existingBusiness = await Businessprofile.findById(businessProfileId);
        if(!existingBusiness) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.WaBa_not_found
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
        const data = await createProductCatalog(metaBusinessId, name, accessToken);
        if(data?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: data?.error?.message
            }
        }
        await Catalog.create({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId,
            catalogId: data.id,
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