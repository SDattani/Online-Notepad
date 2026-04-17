const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Audit = require('../models/audit');
const { getDB } = require('../config/database');
const { validateSignupData } = require('../utils/validation');
const { sendOTPEmail } = require('../utils/email');
const { sendResponse } = require('../utils/response');

const signup = async (req, res) => {
    try {
        validateSignupData(req);
        const { firstName, lastName, emailId, password } = req.body;

        const existingUser = await User.findByEmail(emailId);
        if (existingUser) {
            return sendResponse(res, { status: 400, message: 'Email already registered', data: null });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await User.create({ firstName, lastName, emailId, password: passwordHash });

        await Audit.logUserAction(newUser.id, 'USER_SIGNUP', null, { emailId: newUser.emailId });

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
        return sendResponse(res, { status: 400, message: err.message, data: null });
    }
};

const login = async (req, res) => {
    try {
        const { password } = req.body;
        const emailId = req.body.emailId?.toLowerCase();

        if (!emailId || !validator.isEmail(emailId)) {
            return sendResponse(res, { status: 400, message: 'Enter a valid EmailId', data: null });
        }

        const user = await User.findByEmail(emailId);
        if (!user) {
            await Audit.logUserAction(null, 'LOGIN_FAILED', null, { reason: 'User not found', emailId });
            return sendResponse(res, { status: 404, message: 'Invalid Credentials', data: null });
        }

        const isPasswordValid = await User.validatePassword(password, user.password);
        if (!isPasswordValid) {
            await Audit.logUserAction(user.id, 'LOGIN_FAILED', null, { reason: 'Invalid password' });
            return sendResponse(res, { status: 401, message: 'Invalid Credentials', data: null });
        }

        if (user.isTwoFactorEnabled) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

            const dataToHash = `${user.emailId}.${otp}.${expiresAt}`;
            const hash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(dataToHash).digest('hex');

            // Bundle the state into a secure temporary token
            const tempToken = jwt.sign(
                { emailId: user.emailId, hash, expiresAt },
                process.env.JWT_SECRET,
                { expiresIn: '10m' }
            );

            // Store the state in a cookie so the frontend doesn't have to send it back!
            res.cookie('pending2FA', tempToken, {
                httpOnly: true,
                expires: new Date(expiresAt)
            });

            try {
                await sendOTPEmail(user.emailId, otp);
            } catch (error) {
                console.error('Email sending failed:', error);
                return sendResponse(res, { status: 500, message: 'Failed to send OTP email.', data: null });
            }
            return sendResponse(res, {
                status: 200,
                message: '2FA enabled. OTP sent to your email. Please verify to complete login.',
                data: null // Data is null! Frontend just needs to ask user for OTP.
            });
        }

        await issueTokens(res, user);
        await Audit.logUserAction(user.id, 'LOGIN_SUCCESS', null, null);

        return sendResponse(res, {
            status: 200,
            message: 'User login successfully',
            data: { firstName: user.firstName, lastName: user.lastName, emailId: user.emailId },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};


const logout = async (req, res) => {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
        const db = getDB();
        await db.execute(`DELETE FROM refresh_tokens WHERE token = ?`, [refreshToken]);
    }
    res.cookie('token', null, { expires: new Date(Date.now()) });
    res.cookie('refreshToken', null, { expires: new Date(Date.now()) });
    await Audit.logUserAction(req.user.id, 'LOGOUT', null, null);
    return sendResponse(res, { status: 200, message: 'User logged out successfully', data: null });
};

const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const { pending2FA } = req.cookies; // Read the automated data from the cookie

        if (!otp) {
            return sendResponse(res, { status: 400, message: 'OTP is required', data: null });
        }
        if (!pending2FA) {
            return sendResponse(res, { status: 401, message: '2FA session expired. Please login again.', data: null });
        }

        // Extract emailId, hash, and expiresAt securely
        let decoded;
        try {
            decoded = jwt.verify(pending2FA, process.env.JWT_SECRET);
        } catch (err) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired 2FA session', data: null });
        }

        const { emailId, hash, expiresAt } = decoded;

        if (Date.now() > expiresAt) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired OTP', data: null });
        }

        const dataToHash = `${emailId.toLowerCase()}.${otp}.${expiresAt}`;
        const calculatedHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(dataToHash).digest('hex');
        
        if (calculatedHash !== hash) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired OTP', data: null });
        }

        const user = await User.findByEmail(emailId);
        if (!user) return sendResponse(res, { status: 404, message: 'User not found', data: null });

        await issueTokens(res, user);
        await Audit.logUserAction(user.id, 'LOGIN_SUCCESS_2FA', null, null);

        // Clear the temporary 2FA cookie
        res.clearCookie('pending2FA');

        return sendResponse(res, {
            status: 200,
            message: 'OTP verified successfully. Login complete!',
            data: { firstName: user.firstName, lastName: user.lastName, emailId: user.emailId },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const resendOTP = async (req, res) => {
    try {
        const { pending2FA } = req.cookies; // Read the automated data from the cookie

        if (!pending2FA) {
            return sendResponse(res, { status: 401, message: '2FA session expired. Please login again.', data: null });
        }

        let decoded;
        try {
            decoded = jwt.verify(pending2FA, process.env.JWT_SECRET);
        } catch (err) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired 2FA session', data: null });
        }

        const { emailId } = decoded;
        const user = await User.findByEmail(emailId);
        
        if (!user || !user.isTwoFactorEnabled) {
            return sendResponse(res, { status: 400, message: 'Invalid request', data: null });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const dataToHash = `${user.emailId}.${otp}.${expiresAt}`;
        const hash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(dataToHash).digest('hex');

        // Create a new cookie token with the new expiration and hash
        const tempToken = jwt.sign(
            { emailId: user.emailId, hash, expiresAt },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.cookie('pending2FA', tempToken, {
            httpOnly: true,
            expires: new Date(expiresAt)
        });

        await sendOTPEmail(user.emailId, otp);

        return sendResponse(res, { 
            status: 200, 
            message: 'OTP resent to your email successfully', 
            data: null 
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const cleanupOTPs = async (req, res) => {
    try {
        // With stateless OTPs, cleanup is no longer required because nothing is stored in the DB!
        return sendResponse(res, { status: 200, message: 'Stateless OTPs require no cleanup.', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const issueTokens = async (res, user) => {
    const accessToken = User.generateAccessToken(user);
    const refreshToken = User.generateRefreshToken(user);

    const db = getDB();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.execute(
        `INSERT INTO refresh_tokens (userId, token, expiresAt) VALUES (?, ?, ?)`,
        [user.id, refreshToken, expiresAt]
    );

    res.cookie('token', accessToken, {
        httpOnly: true,
        expires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;
        if (!refreshToken) {
            return sendResponse(res, { status: 401, message: 'No refresh token provided', data: null });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired refresh token', data: null });
        }

        const db = getDB();
        const [rows] = await db.execute(
            `SELECT * FROM refresh_tokens WHERE token = ? AND expiresAt > NOW()`,
            [refreshToken]
        );
        if (rows.length === 0) {
            return sendResponse(res, { status: 401, message: 'Refresh token revoked or expired', data: null });
        }

        const user = await User.findById(decoded._id);
        if (!user) {
            return sendResponse(res, { status: 404, message: 'User not found', data: null });
        }

        // Rotate: delete old refresh token, issue new pair
        await db.execute(`DELETE FROM refresh_tokens WHERE token = ?`, [refreshToken]);
        await issueTokens(res, user);

        return sendResponse(res, {
            status: 200,
            message: 'Token refreshed successfully',
            data: { firstName: user.firstName, lastName: user.lastName, emailId: user.emailId },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

module.exports = { signup, login, logout, verifyOTP, resendOTP, cleanupOTPs, refreshToken };
