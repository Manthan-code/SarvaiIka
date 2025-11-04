const express = require('express');
const usersRouter = require('./users');
const plansRouter = require('./plans');
const subscriptionsRouter = require('./subscriptions');
const chatsRouter = require('./chatRoutes');
const settingsRouter = require('./settings');

const router = express.Router();

router.use('/users', usersRouter);
router.use('/plans', plansRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/chats', chatsRouter);
router.use('/settings', settingsRouter);

module.exports = router;
