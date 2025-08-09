(async () => {
  const mongoose = require('mongoose');
  const BusinessProfile = require('../models/BusinessProfile'); // adjust path

  await mongoose.connect('mongodb+srv://metumsepyarkrtahu:hGxiTrcjvTv3WBbI@cluster0.emmkmiu.mongodb.net/wachat'); // replace with your Mongo URI

  await BusinessProfile.syncIndexes();
  console.log('Indexes synced.');

  await mongoose.disconnect();
})();
