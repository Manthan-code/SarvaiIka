const express = require('express');
const router = express.Router();
const { getBillingHistory } = require('../controllers/billingController.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');


// Route to fetch billing history
router.get('/billing-history', requireAuth, getBillingHistory);

module.exports = router;
