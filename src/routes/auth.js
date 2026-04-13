const express = require('express');
const authRouter = express.Router();
const { UserAuth } = require('../middleware/Auth');
const { signup, login, logout, verifyOTP, resendOTP, cleanupOTPs } = require('../controllers/authController');

/**
 * @swagger
 * /signup:
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
authRouter.post('/signup', signup);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login user
 *     description: If 2FA is enabled, OTP will be sent to your email. Use POST /auth/verify-otp to complete login.
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
authRouter.post('/login', login);

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
authRouter.post('/logout', UserAuth, logout);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify 2FA OTP to complete login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailId, otp]
 *             properties:
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified, login complete
 *       400:
 *         description: emailId and otp are required
 *       401:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
authRouter.post('/auth/verify-otp', verifyOTP);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend 2FA OTP to email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailId]
 *             properties:
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid email or 2FA not enabled
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
authRouter.post('/auth/resend-otp', resendOTP);

/**
 * @swagger
 * /auth/cleanup-otps:
 *   delete:
 *     summary: Manually clean up expired and used OTPs
 *     description: Deletes all OTPs where expiresAt is past or isUsed is true.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTPs cleaned up successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
authRouter.delete('/auth/cleanup-otps', UserAuth, cleanupOTPs);

module.exports = authRouter;
