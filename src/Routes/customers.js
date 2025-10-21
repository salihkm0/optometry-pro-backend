const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats
} = require('../controllers/customerController');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Validation rules (same as before)
const customerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Age must be between 0 and 150'),
  body('sex')
    .optional()
    .isIn(['Male', 'Female', 'Other', ''])
    .withMessage('Invalid sex value'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone must be between 10 and 15 characters'),
  // body('email')
  //   .optional()
  //   .isEmail()
  //   .normalizeEmail()
  //   .withMessage('Please provide a valid email')
];

// Routes with permission checks
router.get('/', checkPermission('customers', 'view'), getCustomers);
router.get('/stats', checkPermission('dashboard', 'stats'), getCustomerStats);
router.get('/:id', checkPermission('customers', 'view'), getCustomerById);
router.post('/', checkPermission('customers', 'create'), customerValidation, handleValidationErrors, createCustomer);
router.put('/:id', checkPermission('customers', 'edit'), customerValidation, handleValidationErrors, updateCustomer);
router.delete('/:id', checkPermission('customers', 'delete'), deleteCustomer);

module.exports = router;