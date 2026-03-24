const express = require('express');
const authRouter = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const User = require('../models/user');
const { validateSignupData } = require('../utils/validation');
const { UserAuth } = require('../middleware/Auth');
const { sendResponse } = require('../utils/response');
const OTP = require('../models/otp');

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: User signed up successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Sahil
 *                     lastName:
 *                       type: string
 *                       example: Dattani
 *                     emailId:
 *                       type: string
 *                       example: sahil@gmail.com
 *       400:
 *         description: Validation error or email already registered
 */

authRouter.post('/signup', async (req, res) => {
    try {
        validateSignupData(req);
        const { firstName, lastName, emailId, password } = req.body;

        const existingUser = await User.findByEmail(emailId);
        if (existingUser) {
            return sendResponse(res, {
                status: 400,
                message: 'Email already registered',
                data: null,
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await User.create({ firstName, lastName, emailId, password: passwordHash });

        return sendResponse(res, {
            status: 201,
            message: 'User signed up successfully',
            data: {
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                emailId: newUser.emailId,
            },
        });
    } catch (err) {
        return sendResponse(res, {
            status: 400,
            message: err.message,
            data: null,
        });
    }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login user
 *     description: If 2FA is enabled returns tempToken instead of cookie. Use POST /auth/verify-otp to complete login.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: User login successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Sahil
 *                     lastName:
 *                       type: string
 *                       example: Dattani
 *                     emailId:
 *                       type: string
 *                       example: sahil@gmail.com
 *       400:
 *         description: Invalid email format
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

authRouter.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        const emailId = req.body.emailId?.toLowerCase();

        if (!emailId || !validator.isEmail(emailId)) {
            return sendResponse(res, {
                status: 400,
                message: 'Enter a valid EmailId',
                data: null,
            });
        }

        const user = await User.findByEmail(emailId);
        if (!user) {
            return sendResponse(res, {
                status: 404,
                message: 'Invalid Credentials',
                data: null,
            });
        }

        const isPasswordValid = await User.validatePassword(password, user.password);
        if (!isPasswordValid) {
            return sendResponse(res, {
                status: 401,
                message: 'Invalid Credentials',
                data: null,
            });
        }

        if (user.isTwoFactorEnabled) {
            const { otp, tempToken } = await OTP.create(user.id);

            console.log(`\n============================`);
            console.log(`2FA OTP for ${user.emailId}: ${otp}`);
            console.log(`============================\n`);

            return sendResponse(res, {
                status: 200,
                message: '2FA enabled. OTP sent. Please verify to complete login.',
                data: {
                    tempToken,  
                    expiresIn: '10 minutes',
                },
            });
        }

        const token = User.generateToken(user);
        res.cookie('token', token, {
            expires: new Date(Date.now() + 604800 * 1000),
        });

        return sendResponse(res, {
            status: 200,
            message: 'User login successfully',
            data: {
                firstName: user.firstName,
                lastName: user.lastName,
                emailId: user.emailId,
            },
        });
    } catch (err) {
        return sendResponse(res, {
            status: 500,
            message: err.message,
            data: null,
        });
    }
});

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: User logged out successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 */

authRouter.post('/logout', UserAuth, async (req, res) => {
    res.cookie('token', null, { expires: new Date(Date.now()) });
    return sendResponse(res, {
        status: 200,
        message: 'User logged out successfully',
        data: null,
    });
});

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify 2FA OTP to complete login
 *     description: Only required when 2FA is enabled. Send tempToken received from login + OTP from console.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tempToken, otp]
 *             properties:
 *               tempToken:
 *                 type: string
 *                 example: a1b2c3d4e5f6...
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully, JWT cookie set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully. Login complete!
 *                 data:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Sahil
 *                     lastName:
 *                       type: string
 *                       example: Dattani
 *                     emailId:
 *                       type: string
 *                       example: sahil@gmail.com
 *       400:
 *         description: tempToken and otp are required
 *       401:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

authRouter.post('/auth/verify-otp', async (req, res) => {
    try {
        const { tempToken, otp } = req.body;

        if (!tempToken || !otp) {
            return sendResponse(res, {
                status: 400,
                message: 'tempToken and otp are required',
                data: null,
            });
        }

        const otpRecord = await OTP.verify(tempToken, otp);
        if (!otpRecord) {
            return sendResponse(res, {
                status: 401,
                message: 'Invalid or expired OTP',
                data: null,
            });
        }

        const user = await User.findById(otpRecord.userId);
        if (!user) {
            return sendResponse(res, {
                status: 404,
                message: 'User not found',
                data: null,
            });
        }

        const token = User.generateToken(user);
        res.cookie('token', token, {
            expires: new Date(Date.now() + 604800 * 1000),
        });

        return sendResponse(res, {
            status: 200,
            message: 'OTP verified successfully. Login complete!',
            data: {
                firstName: user.firstName,
                lastName: user.lastName,
                emailId: user.emailId,
            },
        });
    } catch (err) {
        return sendResponse(res, {
            status: 500,
            message: err.message,
            data: null,
        });
    }
});

/**
 * @swagger
 * /auth/cleanup-otps:
 *   delete:
 *     summary: Manually clean up expired and used OTPs
 *     description: Deletes all OTPs where expiresAt is past or isUsed is true. Valid unused OTPs are kept.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTPs cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Expired and used OTPs cleaned up successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

authRouter.delete('/auth/cleanup-otps', UserAuth, async (req, res) => {
    try {
        await OTP.deleteExpired();

        return sendResponse(res, {
            status: 200,
            message: 'Expired and used OTPs cleaned up successfully',
            data: null,
        });
    } catch (err) {
        return sendResponse(res, {
            status: 500,
            message: err.message,
            data: null,
        });
    }
});

module.exports = authRouter;