const express = require('express');
const authRouter = express.Router();
const rateLimit = require('express-rate-limit');
const { signup, login, verifyOTP, resendOTP, refreshToken } = require('../controllers/authController');

// Rate Limiter for Login & OTP generation (Max 5 requests per 15 minutes)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5,
    message: {
        status: 429,
        message: "Too many requests from this IP, please try again after 15 minutes",
        data: null
    }
});

/**
 * @swagger
 * /api/v1/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, emailId, password]
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Sahil
 *               lastName:
 *                 type: string
 *                 example: Dattani
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *               password:
 *                 type: string
 *                 example: Sah#2003
 *     responses:
 *       201:
 *         description: User signed up successfully
 *       400:
 *         description: Validation error or email already registered
 */
authRouter.post('/api/v1/signup', signup);

/**
 * @swagger
 * /api/v1/login:
 *   post:
 *     summary: Login user
 *     description: If 2FA is enabled, OTP will be sent to your email. Use POST /api/v1/auth/verify-otp to complete login.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailId, password]
 *             properties:
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *               password:
 *                 type: string
 *                 example: Sah#2003
 *     responses:
 *       200:
 *         description: Login successful or 2FA OTP sent
 *       400:
 *         description: Invalid email format
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
authRouter.post('/api/v1/login', otpLimiter, login);

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify 2FA OTP to complete login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified, login complete
 *       400:
 *         description: OTP is required
 *       401:
 *         description: Invalid or expired OTP / Session Expired
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
authRouter.post('/api/v1/auth/verify-otp', otpLimiter, verifyOTP);

/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: Resend 2FA OTP to email
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       401:
 *         description: Session Expired
 *       500:
 *         description: Server error
 */
authRouter.post('/api/v1/auth/resend-otp', otpLimiter, resendOTP);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     description: Issues a new access token (and rotates the refresh token) if the refresh token cookie is valid.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: No refresh token, or invalid/revoked/expired
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
authRouter.post('/api/v1/auth/refresh', refreshToken);

module.exports = authRouter;
