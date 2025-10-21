const mongoose = require('mongoose');
const User = require('../Models/User.js');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/optometry_db');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@optometrypro.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Admin email: admin@optometrypro.com');
      console.log('Admin password: admin123');
      await mongoose.disconnect();
      return;
    }

    // Create admin user
    const admin = new User({
      name: 'System Administrator',
      email: 'admin@optometrypro.com',
      password: 'admin123', // This will be hashed by the pre-save hook
      role: 'admin',
      phone: '+1234567890',
      isActive: true
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Admin email: admin@optometrypro.com');
    console.log('Admin password: admin123');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();