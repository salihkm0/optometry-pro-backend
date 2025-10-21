const mongoose = require('mongoose');
const Shop = require('../Models/Shop.js');
const User = require('../Models/User.js');

// Create new shop with owner (admin only) - FIXED VERSION
const createShop = async (req, res) => {
  try {
    const { name, contact, settings, owner } = req.body;

    console.log('Creating shop with data:', { name, contact, owner });

    // Validate required fields
    if (!name || !contact?.email) {
      return res.status(400).json({ 
        message: 'Shop name and email are required' 
      });
    }

    if (!owner?.name || !owner?.email || !owner?.password) {
      return res.status(400).json({ 
        message: 'Owner name, email, and password are required' 
      });
    }

    // Check if shop with same email already exists
    const existingShop = await Shop.findOne({ 'contact.email': contact.email });
    if (existingShop) {
      return res.status(400).json({ 
        message: 'A shop with this email already exists' 
      });
    }

    // Check if owner with same email already exists
    const existingOwner = await User.findOne({ email: owner.email });
    if (existingOwner) {
      return res.status(400).json({ 
        message: 'A user with this email already exists' 
      });
    }

    // Create shop owner user first
    const ownerUser = new User({
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      password: owner.password,
      role: 'shop_owner',
      isActive: true,
      createdBy: req.user._id
    });

    await ownerUser.save();

    // Create new shop with owner reference
    const shop = new Shop({
      name,
      owner: ownerUser._id,
      contact: {
        email: contact.email,
        phone: contact.phone,
        address: contact.address || {}
      },
      settings: settings || {
        timezone: 'UTC',
        currency: 'USD',
        businessHours: {
          monday: { open: '09:00', close: '17:00', closed: false },
          tuesday: { open: '09:00', close: '17:00', closed: false },
          wednesday: { open: '09:00', close: '17:00', closed: false },
          thursday: { open: '09:00', close: '17:00', closed: false },
          friday: { open: '09:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '17:00', closed: false },
          sunday: { open: '09:00', close: '17:00', closed: true }
        }
      },
      createdBy: req.user._id
    });

    await shop.save();

    // Update owner user with shop reference
    ownerUser.shop = shop._id;
    await ownerUser.save();

    // Populate the response
    await shop.populate('owner', 'name email phone');
    await shop.populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Shop and owner created successfully',
      shop
    });

  } catch (error) {
    console.error('Create shop error:', error);
    
    // Clean up: if user was created but shop creation failed, delete the user
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update shop - FIXED VERSION
const updateShop = async (req, res) => {
  try {
    const { name, contact, settings } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (contact) {
      updateData.contact = {
        email: contact.email,
        phone: contact.phone,
        address: contact.address || {}
      };
    }
    if (settings) updateData.settings = settings;

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      message: 'Shop updated successfully',
      shop
    });
  } catch (error) {
    console.error('Update shop error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Other controller functions remain the same...
const getShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'contact.address.city': { $regex: search, $options: 'i' } }
      ];
    }

    const shops = await Shop.find(query)
      .populate('owner', 'name email phone lastLogin')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Shop.countDocuments(query);

    res.json({
      shops,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('owner', 'name email phone lastLogin');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Get shop statistics
    const [customerCount, recordCount, usersCount] = await Promise.all([
      require('../Models/Customer.js').countDocuments({ shop: req.params.id }),
      require('../Models/OptometryRecord.js').countDocuments({ shop: req.params.id }),
      User.countDocuments({ shop: req.params.id })
    ]);

    res.json({
      shop,
      statistics: {
        customerCount,
        recordCount,
        usersCount
      }
    });
  } catch (error) {
    console.error('Get shop error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateShopStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: active, inactive' 
      });
    }

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { isActive: status === 'active' },
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      message: `Shop status updated to ${status} successfully`,
      shop: {
        _id: shop._id,
        name: shop.name,
        isActive: shop.isActive,
        owner: shop.owner,
        updatedAt: shop.updatedAt
      }
    });
  } catch (error) {
    console.error('Update shop status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getShopUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const shopId = req.params.id;

    console.log("Fetching users for shop ID:", shopId);

    // Validate shop ID
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: 'Invalid shop ID' });
    }

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Check permissions - admin can access any shop, others only their own
    if (req.user.role !== 'admin') {
      const userShopId = req.user.shop?._id || req.user.shop;
      if (userShopId.toString() !== shopId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only view users from your own shop.' 
        });
      }
    }

    const users = await User.find({ shop: shopId })
      .select('-password -refreshToken')
      .populate('shop', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments({ shop: shopId });

    console.log(`Found ${users.length} users for shop ${shopId}`);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get shop users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShops,
  getShopById,
  createShop,
  updateShop,
  updateShopStatus,
  getShopUsers
};