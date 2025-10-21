const User = require('../Models/User.js');
const Shop = require('../Models/Shop.js');
const { generateToken, generateRefreshToken, verifyToken } = require('../utils/generateToken.js');
const { validationResult } = require('express-validator');

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, password, shopName, phone, userType } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    let shop = null;
    
    // Create shop for shop owners
    if (userType === 'shop_owner') {
      shop = new Shop({
        name: shopName,
        contact: {
          email: email,
          phone: phone
        }
      });
      await shop.save();
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role: userType,
      shop: shop ? shop._id : null,
      phone
    });

    await user.save();

    // Update shop with owner reference if shop was created
    if (shop) {
      shop.owner = user._id;
      await shop.save();
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    user.refreshToken = refreshToken; // Store refresh token
    await user.save();

    // Populate shop for response
    await user.populate('shop');

    res.status(201).json({
      message: 'User registered successfully',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop: user.shop ? {
          id: user.shop._id,
          name: user.shop.name
        } : null
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: error.message 
    });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    console.log('Login attempt for email:', email);

    // Find user and populate shop details
    const user = await User.findOne({ email }).populate('shop');
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      console.log('User account deactivated:', email);
      return res.status(400).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Invalid password for:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update last login and store refresh token
    user.lastLogin = new Date();
    user.refreshToken = refreshToken;
    await user.save();

    console.log('Login successful for:', email);

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop: user.shop ? {
          id: user.shop._id,
          name: user.shop.name,
          subscription: user.shop.subscription
        } : null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message 
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('shop')
      .select('-password -refreshToken');

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        shop: user.shop,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Token validation endpoint - FIXED: Don't require auth middleware
const validateToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        valid: false,
        message: 'No token provided' 
      });
    }

    // Verify the token
    const decoded = verifyToken(token);
    
    // Find user by ID
    const user = await User.findById(decoded.userId)
      .populate('shop')
      .select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({ 
        valid: false,
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        valid: false,
        message: 'Account is deactivated' 
      });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop: user.shop,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({ 
      valid: false,
      message: 'Invalid token' 
    });
  }
};

// Token refresh endpoint
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret');
    
    // Find user by refresh token
    const user = await User.findOne({ 
      _id: decoded.userId, 
      refreshToken: refreshToken 
    }).populate('shop');

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop: user.shop ? {
          id: user.shop._id,
          name: user.shop.name
        } : null
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  validateToken,
  refreshToken
};