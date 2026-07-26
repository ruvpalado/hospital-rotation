const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');

// Brute-force protection for the unauthenticated credential/code endpoints.
// Without this, /login and the reset-code endpoints can be hammered freely
// (a 6-digit reset code is only 1,000,000 combinations). Keyed by client IP
// (requires app.set('trust proxy', ...) so the real IP is read from the
// Railway proxy, not the proxy's own address -- see server.js).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/verify-reset-code', authLimiter, authController.verifyResetCode);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
