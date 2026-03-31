const express = require('express');
const authRouter = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const User = require('../models/user');
const { validateSignupData } = require('../utils/validation');
const { UserAuth } = require('../middleware/Auth');
const { sendResponse } = require('../utils/response');
const OTP = require('../models/otp');
const { sendOTPEmail } = require('../utils/email');
const Audit = require('../models/audit');

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

        await Audit.logUserAction(
            newUser.id, 
            'USER_SIGNUP', 
            null, 
            { emailId: newUser.emailId } // newData
        );

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
 *     description: If 2FA is enabled, OTP will be sent to your email. Use POST /auth/verify-otp with your email and OTP to complete login.
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
 *                   oneOf:
 *                     - type: object
 *                       description: 2FA disabled — login complete
 *                       properties:
 *                         firstName:
 *                           type: string
 *                           example: Sahil
 *                         lastName:
 *                           type: string
 *                           example: Dattani
 *                         emailId:
 *                           type: string
 *                           example: sahil@gmail.com
 *                     - type: object
 *                       description: 2FA enabled — OTP sent
 *                       properties:
 *                         expiresIn:
 *                           type: string
 *                           example: 10 minutes
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
            await Audit.logUserAction(null, 'LOGIN_FAILED', null, { reason: 'User not found', emailId });

            return sendResponse(res, {
                status: 404,
                message: 'Invalid Credentials',
                data: null,
            });
        }

        const isPasswordValid = await User.validatePassword(password, user.password);
        if (!isPasswordValid) {
            await Audit.logUserAction(user.id, 'LOGIN_FAILED', null, { reason: 'Invalid password' });

            return sendResponse(res, {
                status: 401,
                message: 'Invalid Credentials',
                data: null,
            });
        }

        if (user.isTwoFactorEnabled) {
            const { otp } = await OTP.create(user.id);

            try {
                await sendOTPEmail(user.emailId, otp);
            } catch (error) {
                console.error('Email sending failed:', error);
                return sendResponse(res, {
                    status: 500,
                    message: 'Failed to send OTP email. Please try again later.',
                    data: null,
                });
            }

            return sendResponse(res, {
                status: 200,
                message: '2FA enabled. OTP sent to your email. Please verify to complete login.',
                data: {
                    expiresIn: '10 minutes',
                },
            });
        }

        const token = User.generateToken(user);
        res.cookie('token', token, {
            expires: new Date(Date.now() + 604800 * 1000),
        });

        await Audit.logUserAction(user.id, 'LOGIN_SUCCESS', null, null);

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

    await Audit.logUserAction(req.user.id, 'LOGOUT', null, null);

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

authRouter.post('/auth/verify-otp', async (req, res) => {
    try {
        const otp  = req.body.otp;
        const emailId = req.body.emailId

        if (!emailId || !otp) {
            return sendResponse(res, {
                status: 400,
                message: 'emailId and otp are required',
                data: null,
            });
        }

        if (!validator.isEmail(emailId)) {
            return sendResponse(res, {
                status: 400,
                message: 'Invalid email address',
                data: null,
            });
        }

        const otpRecord = await OTP.verify(emailId  , otp);
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

        await Audit.logUserAction(user.id, 'LOGIN_SUCCESS_2FA', null, null);

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

authRouter.post('/auth/resend-otp', async (req, res) => {
    try {
        const emailId = req.body.emailId?.toLowerCase();

        if (!emailId || !validator.isEmail(emailId)) {
            return sendResponse(res, {
                status: 400,
                message: 'Enter a valid emailId',
                data: null,
            });
        }

        const user = await User.findByEmail(emailId);
        if (!user) {
            return sendResponse(res, {
                status: 404,
                message: 'User not found',
                data: null,
            });
        }

        if (!user.isTwoFactorEnabled) {
            return sendResponse(res, {
                status: 400,
                message: '2FA is not enabled for this account',
                data: null,
            });
        }

        const { otp } = await OTP.create(user.id);
        await sendOTPEmail(user.emailId, otp);

        return sendResponse(res, {
            status: 200,
            message: 'OTP resent to your email successfully',
            data: { expiresIn: '10 minutes' },
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