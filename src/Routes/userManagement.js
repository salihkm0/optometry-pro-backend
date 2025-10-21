const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const {
  getShopUsers,
  createShopUser,
  updateShopUser,
  deleteShopUser,
  getShopUserById,
  resetUserPassword
} = require('../controllers/userManagementController');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication and users.view permission
router.use(auth, checkPermission('users', 'view'));

// Validation rules
// const createUserValidation = [
//   body('name')
//     .trim()
//     .isLength({ min: 2, max: 100 })
//     .withMessage('Name must be between 2 and 100 characters'),
//   body('email')
//     .isEmail()
//     .normalizeEmail()
//     .withMessage('Please provide a valid email'),
//   body('password')
//     .isLength({ min: 6 })
//     .withMessage('Password must be at least 6 characters long'),
//   body('role')
//     .isIn(['shop_owner', 'optometrist', 'assistant', 'receptionist'])
//     .withMessage('Invalid role'),
//   body('phone')
//     .optional()
//     .trim()
//     .isLength({ min: 10, max: 15 })
//     .withMessage('Phone must be between 10 and 15 characters')
// ];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .optional()
    .isIn(['shop_owner', 'optometrist', 'assistant', 'receptionist'])
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone must be between 10 and 15 characters')
];

const resetPasswordValidation = [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// Routes
router.get('/', getShopUsers);
router.get('/:id', getShopUserById);
router.post('/', checkPermission('users', 'create'),  handleValidationErrors, createShopUser);
router.put('/:id', checkPermission('users', 'edit'), updateUserValidation, handleValidationErrors, updateShopUser);
router.delete('/:id', checkPermission('users', 'delete'), deleteShopUser);
router.post('/:id/reset-password', checkPermission('users', 'edit'), resetPasswordValidation, handleValidationErrors, resetUserPassword);

module.exports = router;