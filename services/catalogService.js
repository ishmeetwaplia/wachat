const mongoose = require('mongoose');
const { statusCode, resMessage } = require("../config/constants");
const { getBusinessData, createProductCatalog, getOwnedProductCatalogs, createProduct } = require('../functions/functions');
const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');
const Product = require('../models/Product');

exports.create = async (req) => {
    try {
        const { metaBusinessId } = req.params;
        const { accessToken } = req.query;
        const { name } = req.body;

        if (!mongoose.Types.ObjectId.isValid(metaBusinessId)) {
            return { 
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ _id: metaBusinessId, userId: req.user._id, tenantId: req.tenant._id });
        if(!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            }
        }
        const checkMetaId = await getBusinessData(isMetaId.metaId, accessToken);
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
        const catalogData = await createProductCatalog(isMetaId.metaId, name, accessToken);
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
            businessProfileId: metaBusinessId,
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

        if (!mongoose.Types.ObjectId.isValid(metaBusinessId)) {
            return { 
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ _id: metaBusinessId, userId: req.user._id, tenantId: req.tenant._id });
        if(!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            }
        }

        const catalogs = await getOwnedProductCatalogs(isMetaId.metaId, isMetaId.businessIdAccessToken);

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
            businessProfileId: metaBusinessId,
            catalogId: item.id,
            name: item.name || "Untitled Catalog"
        })) || [];

        if (catalogDocs.length === 0) {
            await Catalog.deleteMany({
                userId: req.user._id,
                tenantId: req.tenant._id,
                businessProfileId: metaBusinessId
            });

            return {
                status: statusCode.SUCCESS,
                success: true,
                message: "All catalogs deleted because none were found from Meta API"
            };
        }

        const existingCatalogs = await Catalog.find({
            userId: req.user._id,
            tenantId: req.tenant._id,
            businessProfileId: metaBusinessId
        }).distinct("catalogId");

        const metaCatalogIds = catalogDocs.map(c => c.catalogId);

        const newCatalogs = catalogDocs.filter(c => !existingCatalogs.includes(c.catalogId));

        const catalogsToDelete = existingCatalogs.filter(id => !metaCatalogIds.includes(id));

        if (newCatalogs.length > 0) {
            await Catalog.insertMany(newCatalogs);
        }

        if (catalogsToDelete.length > 0) {
            await Catalog.deleteMany({
                catalogId: { $in: catalogsToDelete },
                userId: req.user._id,
                tenantId: req.tenant._id,
                businessProfileId: metaBusinessId
            });
        }

        return {
            status: statusCode.SUCCESS,
            success: true,
            message: resMessage.Catalogs_sync_successfully,
            newCatalogsAdded: newCatalogs.length,
            catalogsDeleted: catalogsToDelete.length
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
        const { page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(metaBusinessId)) {
            return { 
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Invalid_business_ID
            };
        }

        const isMetaId = await Businessprofile.findOne({ 
            _id: metaBusinessId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        });
        if (!isMetaId) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: resMessage.Business_profile_not_found
            };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const data = await Catalog.find({ 
            businessProfileId: metaBusinessId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        })
        .skip(skip)
        .limit(Number(limit));

        const totalRecords = await Catalog.countDocuments({
            businessProfileId: metaBusinessId, 
            userId: req.user._id, 
            tenantId: req.tenant._id 
        });

        if (!data || data.length === 0) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.No_data_found
            };
        }

        return {
            data,
            pagination: {
                totalRecords,
                currentPage: Number(page),
                totalPages: Math.ceil(totalRecords / Number(limit)),
                pageSize: Number(limit)
            },
            status: statusCode.OK,
            success: true,
            message: resMessage.Data_fetch_successfully
        };

    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
};

exports.createProduct = async (req) => {
    try {
        let { catalogId } = req.params;
        const productData = {
            retailer_id: req.body.retailer_id,
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            currency: req.body.currency,
            availability: req.body.availability,
            condition: req.body.condition,
            image_url: req.body.image_url,
        };
        const catalogData = await Catalog.findOne({ userId: req.user._id, tenantId: req.tenant._id, catalogId });
        if(!catalogData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Catalog_not_found
            }
        }
        const businessData = await Businessprofile.findOne({ metaBusinessId: catalogData.businessProfileId });
        if (!businessData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            };
        }
        let ACCESS_TOKEN = businessData.businessIdAccessToken;
        const result = await createProduct(productData, catalogId, ACCESS_TOKEN);
        if (result?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: result?.error?.message
            };
        }
        const dbData = {
            retailer_id: req.body.retailer_id,
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            currency: req.body.currency,
            availability: req.body.availability,
            condition: req.body.condition,
            image_url: req.body.image_url,
            userId: req.user._id,
            tenantId: req.tenant._id,
            catalogId: catalogData._id,
            meta_product_id: result.id
        };
        await Product.create(dbData);
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Product_created
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}