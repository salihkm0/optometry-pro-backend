const User = require('../Models/User.js');
const Shop = require('../Models/Shop.js');
const { generateToken } = require('../utils/generateToken');

// Get all users for a shop (shop owners and admin only)
const getShopUsers = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    const { page = 1, limit = 10, role } = req.query;

    const query = { shop: shopId };
    if (role) query.role = role;

    const users = await User.find(query)
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
    console.error('Get shop users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new user for shop
const createShopUser = async (req, res) => {
  try {
 
    const shopId = req.user.role === 'admin' ? req.body.shop :  req.user.shop?._id || req.user.shop;
    const { name, email, password, role, phone, department, licenseNumber, specialization, notes } = req.body;

    console.log("req.user : ", req.user)
    console.log("req.body : ", req.body)
    console.log("shopId : ", shopId)
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Verify the shop exists and user has permission
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role: role || shop.settings.defaultUserRole,
      shop: shopId,
      phone,
      department,
      licenseNumber,
      specialization,
      notes
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create shop user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update shop user
const updateShopUser = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    const { id } = req.params;
    const { name, role, phone, department, licenseNumber, specialization, notes, isActive } = req.body;

    console.log(req.user)
    console.log(req.params)
    console.log(req.body)
    const user = await User.findOneAndUpdate(
      { _id: id, shop: shopId },
      { name, role, phone, department, licenseNumber, specialization, notes, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update shop user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete shop user (soft delete)
const deleteShopUser = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    const { id } = req.params;

    const user = await User.findOneAndUpdate(
      { _id: id, shop: shopId },
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      user
    });
  } catch (error) {
    console.error('Delete shop user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID
const getShopUserById = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    const { id } = req.params;

    const user = await User.findOne({ _id: id, shop: shopId })
      .select('-password')
      .populate('shop', 'name');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get shop user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset user password
const resetUserPassword = async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({ _id: id, shop: shopId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShopUsers,
  createShopUser,
  updateShopUser,
  deleteShopUser,
  getShopUserById,
  resetUserPassword
};