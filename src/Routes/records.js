const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getCustomerRecords,
  getRecordsStats
} = require('../controllers/recordController');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Validation rules (same as before)
const recordValidation = [
  body('customer')
    .notEmpty()
    .withMessage('Customer ID is required')
    .isMongoId()
    .withMessage('Invalid customer ID'),
  body('date')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('examinationType')
    .optional()
    .isIn(['routine', 'comprehensive', 'contact_lens', 'follow_up', 'emergency', 'other'])
    .withMessage('Invalid examination type'),
  body('status')
    .optional()
    .isIn(['draft', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

// Routes with permission checks
router.get('/', checkPermission('records', 'view'), getRecords);
router.get('/stats', checkPermission('dashboard', 'stats'), getRecordsStats);
router.get('/customer/:customerId', checkPermission('records', 'view'), getCustomerRecords);
router.get('/:id', checkPermission('records', 'view'), getRecordById);
router.post('/', checkPermission('records', 'create'), recordValidation, handleValidationErrors, createRecord);
router.put('/:id', checkPermission('records', 'edit'), recordValidation, handleValidationErrors, updateRecord);
router.delete('/:id', checkPermission('records', 'delete'), deleteRecord);

module.exports = router;