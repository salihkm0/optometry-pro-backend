const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const {
  getShopPermissions,
  updateRolePermissions,
  createUserPermissions,
  getUserSpecificPermissions,
  resetRolePermissions,
  initializeShopPermissions,
  getUserPermissions,
  checkUserPermission,
  checkPageAccess,
  getAvailablePermissions
} = require('../controllers/permissionController');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Validation rules
const updatePermissionsValidation = [
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('pageAccess')
    .optional()
    .isArray()
    .withMessage('Page access must be an array')
];

const userPermissionsValidation = [
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
  body('accessiblePages')
    .optional()
    .isArray()
    .withMessage('Accessible pages must be an array')
];

// Public permission routes (for frontend)
router.get('/my-permissions', getUserPermissions);
router.get('/check-permission', checkUserPermission);
router.get('/check-page-access', checkPageAccess);
router.get('/available-permissions', getAvailablePermissions);

// Shop permission management routes
router.get('/shop/:shopId', getShopPermissions);
router.put('/shop/:shopId/role/:role', updatePermissionsValidation, handleValidationErrors, updateRolePermissions);
router.post('/shop/:shopId/role/:role/reset', resetRolePermissions);
router.post('/shop/:shopId/initialize', initializeShopPermissions);

// User-specific permission management routes
router.post('/user/:userId', userPermissionsValidation, handleValidationErrors, createUserPermissions);
router.get('/user/:userId', getUserSpecificPermissions);

module.exports = router;