const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const User = require('../Models/User.js');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get shop users (shop owners and admins only)
router.get('/shop-users', requireRole('shop_owner', 'admin'), async (req, res) => {
  try {
    const shopId = req.user.shop?._id || req.user.shop;
    
    const users = await User.find({ shop: shopId })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Get shop users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;