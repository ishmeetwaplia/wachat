const { statusCode, resMessage } = require("../config/constants");
const { getBusinessData, createProductCatalog, getOwnedWhatsAppAccounts } = require('../functions/functions');
const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');

exports.create = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const { accessToken } = req.query;
        const { name, businessProfileId } = req.body;
        const data = await getOwnedWhatsAppAccounts(metaBusinessId, accessToken);
        if(data?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: data?.error?.message
            }
        }
        const wabaIds = data?.owned_whatsapp_business_accounts?.data.map(acc => acc.id) || [];
        const existingBusiness = await Businessprofile.findOne({ metaBusinessId: businessProfileId, userId: req.user._id });
        if(!existingBusiness) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.WaBa_not_found
            }
        }
        if (!wabaIds.includes(businessProfileId)) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            };
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
        existingBusiness.metaId = checkMetaId.id;
        await existingBusiness.save();
        await Catalog.create({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId,
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