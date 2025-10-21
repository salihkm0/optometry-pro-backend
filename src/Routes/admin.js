const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const {
  getDashboardStats,
  getShops,
  getShopById,
  updateShop,
  updateShopStatus,
  getShopCustomers,
  getShopRecords,
  getUsers,
  updateUser
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth, requireRole('admin'));

// Dashboard routes
router.get('/dashboard', getDashboardStats);

// Shop management routes
router.get('/shops', getShops);
router.get('/shops/:id', getShopById);
router.put('/shops/:id', updateShop);
router.patch('/shops/:id/status', updateShopStatus); // Fixed: Added status endpoint
router.get('/shops/:id/customers', getShopCustomers);
router.get('/shops/:id/records', getShopRecords);

// User management routes
router.get('/users', getUsers);
router.put('/users/:id', updateUser);

module.exports = router;