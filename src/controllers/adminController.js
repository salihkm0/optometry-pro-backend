const User = require('../Models/User.js');
const Shop = require('../Models/Shop.js');
const Customer = require('../Models/Customer.js');
const OptometryRecord = require('../Models/OptometryRecord.js');

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalShops,
      activeShops,
      totalCustomers,
      totalRecords,
      totalRevenue,
      recentRegistrations
    ] = await Promise.all([
      Shop.countDocuments(),
      Shop.countDocuments({ 'subscription.status': 'active' }),
      Customer.countDocuments(),
      OptometryRecord.countDocuments(),
      // Calculate revenue (you'll need to implement this based on your billing system)
      Promise.resolve(0),
      Shop.find()
        .populate('owner', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Get monthly growth
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const recordsThisMonth = await OptometryRecord.countDocuments({
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lte: new Date(currentYear, currentMonth + 1, 0)
      }
    });

    const recordsLastMonth = await OptometryRecord.countDocuments({
      createdAt: {
        $gte: new Date(currentYear, currentMonth - 1, 1),
        $lte: new Date(currentYear, currentMonth, 0)
      }
    });

    const monthlyGrowth = recordsLastMonth > 0 
      ? ((recordsThisMonth - recordsLastMonth) / recordsLastMonth * 100).toFixed(1)
      : 100;

    res.json({
      totalShops,
      activeShops,
      totalCustomers,
      totalRecords,
      totalRevenue,
      monthlyGrowth: parseFloat(monthlyGrowth),
      recentActivity: recentRegistrations.map(shop => ({
        id: shop._id,
        name: shop.name,
        owner: shop.owner.name,
        email: shop.owner.email,
        createdAt: shop.createdAt
      }))
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status; // Changed from subscription.status to status
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

const getShopById = async (req, res) => {
  try {
    
    const shop = await Shop.findById(req.params.id)
      .populate('owner', 'name email phone lastLogin');

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Get shop statistics
    const [customerCount, recordCount, usersCount] = await Promise.all([
      Customer.countDocuments({ shop: req.params.id }),
      OptometryRecord.countDocuments({ shop: req.params.id }),
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

const updateShop = async (req, res) => {
  try {
    const { name, ownerName, ownerEmail, ownerPhone, address, settings, subscription, isActive } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (ownerName) updateData.ownerName = ownerName;
    if (ownerEmail) updateData.ownerEmail = ownerEmail;
    if (ownerPhone) updateData.ownerPhone = ownerPhone;
    if (address) updateData.address = address;
    if (settings) updateData.settings = settings;
    if (subscription) updateData.subscription = subscription;
    if (isActive !== undefined) updateData.isActive = isActive;

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

// ADDED: updateShopStatus function
const updateShopStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
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
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

const getShopCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const customers = await Customer.find({ shop: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments({ shop: req.params.id });

    res.json({
      customers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get shop customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getShopRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const records = await OptometryRecord.find({ shop: req.params.id })
      .populate('customer', 'name age sex')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await OptometryRecord.countDocuments({ shop: req.params.id });

    res.json({
      records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get shop records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    
    const query = {};
    if (role) query.role = role;

    const users = await User.find(query)
      .populate('shop', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { role, isActive } = req.body;
    
    const updateData = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('shop', 'name')
    .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats,
  getShops,
  getShopById,
  updateShop,
  updateShopStatus, // ADDED: Export the new function
  getShopCustomers,
  getShopRecords,
  getUsers,
  updateUser
};