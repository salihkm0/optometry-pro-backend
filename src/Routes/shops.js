const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Shop = require('../Models/Shop.js');
const {
  getShops,
  getShopById,
  createShop,
  updateShop,
  updateShopStatus,
  getShopUsers
} = require('../controllers/shopController'); // ADD THIS

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all shops (admin only)
router.get('/', requireRole('admin'), getShops);

// Get shop by ID
router.get('/:id', getShopById);

// Create new shop (admin only)
router.post('/', requireRole('admin'), createShop);

// Update shop
router.put('/:id', updateShop);

// Update shop status (admin only)
router.patch('/:id/status', requireRole('admin'), updateShopStatus);

// Get shop users
router.get('/:id/users', getShopUsers);

// Get current user's shop
router.get('/my-shop', async (req, res) => {
  try {
    if (!req.user.shop) {
      return res.status(404).json({ message: 'No shop associated with this user' });
    }

    const shop = await Shop.findById(req.user.shop._id || req.user.shop);
    
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.json(shop);
  } catch (error) {
    console.error('Get my shop error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update current user's shop (shop owners only)
router.put('/my-shop', requireRole('shop_owner'), async (req, res) => {
  try {
    const { name, contact, settings } = req.body;
    
    const shop = await Shop.findByIdAndUpdate(
      req.user.shop._id || req.user.shop,
      { name, contact, settings },
      { new: true, runValidators: true }
    );

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
});

module.exports = router;