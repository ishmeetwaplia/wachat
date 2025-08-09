require('dotenv').config({ path: './.env' }); // Load .env from parent directory
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const connectDB = require('../config/db');

// Connect to the database
connectDB();

const createSuperAdmin = async () => {
    const superAdminTenantName = 'SuperAdminCo';
    const superAdminTenantDomain = 'http://localhost:5173/'; // Use a specific domain for the super admin
    const superAdminWebsiteName = 'Global Admin Portal';
    const superAdminUsername = 'superadmin';
    const superAdminEmail = 'superadmin@example.com';
    const superAdminPassword = 'test123'; // CHANGE THIS IN PRODUCTION!!!

    try {
        console.log('Attempting to create Super Admin Tenant and User...');

        // Check if a super admin tenant already exists
        const existingSuperAdminTenant = await Tenant.findOne({ isSuperAdmin: true });
        if (existingSuperAdminTenant) {
            console.log(`\nSuper Admin Tenant '${existingSuperAdminTenant.name}' (Domain: ${existingSuperAdminTenant.domain}) already exists. Skipping creation.`);
            // Optionally, update existing super admin tenant/user here if needed
            process.exit(0);
        }

        // Check if the domain is already used by another tenant
        const domainExists = await Tenant.findOne({ domain: superAdminTenantDomain });
        if (domainExists) {
            console.error(`\nError: Domain '${superAdminTenantDomain}' is already in use by another tenant. Please choose a unique domain.`);
            process.exit(1);
        }

        // Create the Super Admin Tenant
        const superTenant = await Tenant.create({
            name: superAdminTenantName,
            domain: superAdminTenantDomain,
            faviconUrl: 'https://placehold.co/16x16/000000/FFFFFF?text=SA',
            websiteName: superAdminWebsiteName,
            isActive: true,
            isSuperAdmin: true,
        });
        console.log(`\nSuper Admin Tenant Created: ${superTenant.name} (${superTenant.domain})`);

        // Create the Super Admin User
        const superUser = await User.create({
            tenantId: superTenant._id,
            username: superAdminUsername,
            email: superAdminEmail,
            password: superAdminPassword,
            role: 'tenant_admin', // Super admin user will have tenant_admin role but for the super admin tenant
        });
        console.log(`Super Admin User Created: ${superUser.username} (Email: ${superUser.email})`);
        console.log(`\nSuccessfully created the first Super Admin tenant and user.`);
        console.log(`  Access the Super Admin portal via: http://${superAdminTenantDomain}:<YOUR_FRONTEND_PORT>/super-admin`);
        console.log(`  Login with: Email: ${superAdminEmail}, Password: ${superAdminPassword}`);
    } catch (error) {
        console.error('\nError creating Super Admin:', error.message);
        console.error('Make sure your MongoDB is running and accessible.');
        console.error('Check your .env file for MONGO_URI and JWT_SECRET.');
    } finally {
        // Disconnect from MongoDB
        mongoose.connection.close();
        process.exit();
    }
};

createSuperAdmin();
