const bcrypt = require('bcrypt');
const validator = require('validator');
const User = require('../models/user');
const OTP = require('../models/otp');
const Audit = require('../models/audit');
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
            const { otp } = await OTP.create(user.id);
            try {
                await sendOTPEmail(user.emailId, otp);
            } catch (error) {
                console.error('Email sending failed:', error);
                return sendResponse(res, { status: 500, message: 'Failed to send OTP email. Please try again later.', data: null });
            }
            return sendResponse(res, {
                status: 200,
                message: '2FA enabled. OTP sent to your email. Please verify to complete login.',
                data: { expiresIn: '10 minutes' },
            });
        }

        const token = User.generateToken(user);
        res.cookie('token', token, { expires: new Date(Date.now() + 604800 * 1000) });

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
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const logout = async (req, res) => {
    res.cookie('token', null, { expires: new Date(Date.now()) });
    await Audit.logUserAction(req.user.id, 'LOGOUT', null, null);
    return sendResponse(res, { status: 200, message: 'User logged out successfully', data: null });
};

const verifyOTP = async (req, res) => {
    try {
        const otp = req.body.otp;
        const emailId = req.body.emailId;

        if (!emailId || !otp) {
            return sendResponse(res, { status: 400, message: 'emailId and otp are required', data: null });
        }
        if (!validator.isEmail(emailId)) {
            return sendResponse(res, { status: 400, message: 'Invalid email address', data: null });
        }

        const otpRecord = await OTP.verify(emailId, otp);
        if (!otpRecord) {
            return sendResponse(res, { status: 401, message: 'Invalid or expired OTP', data: null });
        }

        const user = await User.findById(otpRecord.userId);
        if (!user) {
            return sendResponse(res, { status: 404, message: 'User not found', data: null });
        }

        const token = User.generateToken(user);
        res.cookie('token', token, { expires: new Date(Date.now() + 604800 * 1000) });

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
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const resendOTP = async (req, res) => {
    try {
        const emailId = req.body.emailId?.toLowerCase();

        if (!emailId || !validator.isEmail(emailId)) {
            return sendResponse(res, { status: 400, message: 'Enter a valid emailId', data: null });
        }

        const user = await User.findByEmail(emailId);
        if (!user) {
            return sendResponse(res, { status: 404, message: 'User not found', data: null });
        }
        if (!user.isTwoFactorEnabled) {
            return sendResponse(res, { status: 400, message: '2FA is not enabled for this account', data: null });
        }

        const { otp } = await OTP.create(user.id);
        await sendOTPEmail(user.emailId, otp);

        return sendResponse(res, { status: 200, message: 'OTP resent to your email successfully', data: { expiresIn: '10 minutes' } });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const cleanupOTPs = async (req, res) => {
    try {
        await OTP.deleteExpired();
        return sendResponse(res, { status: 200, message: 'Expired and used OTPs cleaned up successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

module.exports = { signup, login, logout, verifyOTP, resendOTP, cleanupOTPs };
