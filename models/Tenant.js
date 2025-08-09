// const mongoose = require('mongoose');

// const TenantSchema = new mongoose.Schema({
//     name: { type: String, required: true, unique: true },
//     domain: { type: String, required: true, unique: true }, // e.g., 'tenant1.com', 'tenant2.org'
//     faviconUrl: { type: String, default: 'https://placehold.co/16x16/cccccc/000000?text=Fav' },
//     websiteName: { type: String, required: true },
//     isActive: { type: Boolean, default: true }, // On/Off control
//     isSuperAdmin: { type: Boolean, default: false }, // Only the first tenant can be super admin
//      metaApi: {
//         wabaId: { type: String, default: '' },
//         accessToken: { type: String, default: '' }, // Highly sensitive, consider encryption in production DB
//         appId: { type: String, default: '' },
//         facebookUrl: { type: String, default: 'https://graph.facebook.com' },
//         graphVersion: { type: String, default: 'v19.0' }, // Default for new tenants
//     },
//     createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('Tenant', TenantSchema);



const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    domain: { type: String, required: true, unique: true }, // e.g., 'tenant1.com', 'tenant2.org'
    faviconUrl: { type: String, default: 'https://placehold.co/16x16/cccccc/000000?text=Fav' },
    websiteName: { type: String, required: true },
    isActive: { type: Boolean, default: true }, // On/Off control
    isSuperAdmin: { type: Boolean, default: false }, // Only the first tenant can be super admin
    metaApi: {
        wabaId: { type: String, default: '' },
        accessToken: { type: String, default: '' }, // Highly sensitive, consider encryption in production DB
        appId: { type: String, default: '' },
        facebookUrl: { type: String, default: 'https://graph.facebook.com' },
        graphVersion: { type: String, default: 'v19.0' }, // Default for new tenants
    },
    // NEW FIELDS FOR WEBSITE CONTENT
    logoUrl: { // URL for the company logo
        type: String,
        default: 'https://placehold.co/150x50/cccccc/000000?text=Logo' // Placeholder logo
    },
    heroSection: {
        image: { // URL for the hero section background image
            type: String,
            default: 'https://placehold.co/1920x600/cccccc/000000?text=Hero+Image' // Placeholder hero image
        },
        title: { // Main title for the hero section
            type: String,
            default: 'Welcome to Our Website'
        },
        subtitle: { // Subtitle or descriptive text for the hero section
            type: String,
            default: 'Your trusted partner for innovative solutions.'
        },
        buttonText: { // Optional button text for hero section CTA
            type: String,
            default: 'Learn More'
        },
        buttonLink: { // Optional button link for hero section CTA
            type: String,
            default: '#'
        }
    },
    testimonials: [ // Array of testimonials
        {
            quote: { type: String, default: '' },
            author: { type: String, default: '' },
            designation: { type: String, default: '' } // Optional: author's designation
        }
    ],
    aboutUsText: { // Detailed text for an "About Us" section
        type: String,
        default: 'We are a company dedicated to providing high-quality services and products to our customers. Our mission is to innovate and deliver excellence in everything we do.'
    },
    contactInfo: { // General contact information
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' }
    },
    socialMediaLinks: { // URLs for social media profiles
        facebook: { type: String, default: '' },
        twitter: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        instagram: { type: String, default: '' },
        // Add more as needed
    },
    privacyPolicyUrl: { // Link to the privacy policy page
        type: String,
        default: '#'
    },
    termsOfServiceUrl: { // Link to the terms of service page
        type: String,
        default: '#'
    },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Tenant', TenantSchema);
