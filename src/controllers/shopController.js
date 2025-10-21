const { default: mongoose } = require('mongoose');
const Shop = require('../Models/Shop.js');
const User = require('../Models/User.js');

// Get all shops (admin only)
const getShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const shops = await Shop.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Shop.countDocuments(query);

    res.json({
      shops,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get shop by ID
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

// Create new shop (admin only)
const createShop = async (req, res) => {
  try {
    const { name, ownerEmail, ownerName, ownerPhone, address, settings } = req.body;

    // Check if shop name already exists
    const existingShop = await Shop.findOne({ name });
    if (existingShop) {
      return res.status(400).json({ message: 'Shop name already exists' });
    }

    // Check if owner email exists as a user
    let owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      // Create new user for the owner
      owner = new User({
        name: ownerName,
        email: ownerEmail,
        password: 'temp123', // Temporary password, should be changed
        role: 'shop_owner',
        phone: ownerPhone
      });
      await owner.save();
    } else {
      // Update existing user to shop owner role
      owner.role = 'shop_owner';
      await owner.save();
    }

    // Create shop
    const shop = new Shop({
      name,
      owner: owner._id,
      contact: {
        email: ownerEmail,
        phone: ownerPhone
      },
      address,
      settings
    });

    await shop.save();

    // Update owner's shop reference
    owner.shop = shop._id;
    await owner.save();

    // Initialize permissions for the shop
    await shop.initializePermissions();

    res.status(201).json({
      message: 'Shop created successfully',
      shop: await Shop.findById(shop._id).populate('owner', 'name email')
    });
  } catch (error) {
    console.error('Create shop error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update shop
const updateShop = async (req, res) => {
  try {
    const { name, contact, address, settings, subscription } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (contact) updateData.contact = contact;
    if (address) updateData.address = address;
    if (settings) updateData.settings = settings;
    if (subscription) updateData.subscription = subscription;

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'name email');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      message: 'Shop updated successfully',
      shop
    });
  } catch (error) {
    console.error('Update shop error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update shop status
const updateShopStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: active, inactive, suspended' 
      });
    }

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('owner', 'name email');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json({
      message: `Shop status updated to ${status} successfully`,
      shop: {
        _id: shop._id,
        name: shop.name,
        status: shop.status,
        owner: shop.owner,
        updatedAt: shop.updatedAt
      }
    });
  } catch (error) {
    console.error('Update shop status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get shop users
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