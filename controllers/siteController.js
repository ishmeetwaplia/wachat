const getSiteConfig = async (req, res) => {
    // req.tenant is already populated by tenantResolver middleware
    if (!req.tenant) {
        return res.status(404).json({ message: 'Site configuration not found for this domain.' });
    }
    // Return only necessary public config data
    res.json({
        _id: req.tenant._id, // Tenant ID can be public
        name: req.tenant.name, // Tenant name can be public
        domain: req.tenant.domain, // Domain can be public
        websiteName: req.tenant.websiteName,
        faviconUrl: req.tenant.faviconUrl,
        logoUrl: req.tenant.logoUrl, // NEW
        heroSection: req.tenant.heroSection, // NEW
        testimonials: req.tenant.testimonials, // NEW
        aboutUsText: req.tenant.aboutUsText, // NEW
        contactInfo: req.tenant.contactInfo, // NEW
        socialMediaLinks: req.tenant.socialMediaLinks, // NEW
        privacyPolicyUrl: req.tenant.privacyPolicyUrl, // NEW
        termsOfServiceUrl: req.tenant.termsOfServiceUrl, // NEW
        // Add other public branding/config fields here
    });
};

module.exports = { getSiteConfig };