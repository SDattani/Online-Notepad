const bcrypt = require('bcrypt');
const { getDB } = require('../config/database');
const User = require('../models/user');
const Audit = require('../models/audit');
const { sendResponse } = require('../utils/response');

const getProfile = async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT firstName, lastName FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length === 0) {
            return sendResponse(res, { status: 404, message: 'User not found', data: null });
        }
        return sendResponse(res, { status: 200, message: 'User profile fetched successfully', data: rows[0] });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return sendResponse(res, { status: 400, message: 'Old password and new password are required', data: null });
        }

        const isOldPasswordValid = await User.validatePassword(oldPassword, req.user.password);
        if (!isOldPasswordValid) {
            return sendResponse(res, { status: 401, message: 'Invalid old password', data: null });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(req.user.id, newPasswordHash);

        await Audit.logUserAction(req.user.id, 'PASSWORD_UPDATED', null, null);

        return sendResponse(res, { status: 200, message: `${req.user.firstName} your password updated successfully`, data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const enable2FA = async (req, res) => {
    try {
        if (req.user.isTwoFactorEnabled) {
            return sendResponse(res, { status: 400, message: '2FA is already enabled', data: null });
        }
        await User.enableTwoFactor(req.user.id);
        await Audit.logUserAction(req.user.id, '2FA_ENABLED', { isTwoFactorEnabled: false }, { isTwoFactorEnabled: true });
        return sendResponse(res, { status: 200, message: '2FA enabled successfully. OTP will be required on next login.', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const disable2FA = async (req, res) => {
    try {
        if (!req.user.isTwoFactorEnabled) {
            return sendResponse(res, { status: 400, message: '2FA is already disabled', data: null });
        }
        await User.disableTwoFactor(req.user.id);
        await Audit.logUserAction(req.user.id, '2FA_DISABLED', { isTwoFactorEnabled: true }, { isTwoFactorEnabled: false });
        return sendResponse(res, { status: 200, message: '2FA disabled successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getAccountAuditLogs = async (req, res) => {
    try {
        const db = getDB();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [logs] = await db.execute(
            `SELECT * FROM user_audit_log WHERE userId = ? ORDER BY createdAt DESC LIMIT ${limit}`,
            [req.user.id]
        );
        return sendResponse(res, { status: 200, message: 'Account audit logs fetched', data: logs });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getNoteAuditLogs = async (req, res) => {
    try {
        const db = getDB();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [logs] = await db.execute(
            `SELECT * FROM note_audit_log WHERE userId = ? ORDER BY createdAt DESC LIMIT ${limit}`,
            [req.user.id]
        );
        return sendResponse(res, { status: 200, message: 'Note audit logs fetched', data: logs });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getSharedAuditLogs = async (req, res) => {
    try {
        const db = getDB();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [logs] = await db.execute(
            `SELECT * FROM shared_note_audit_log WHERE userId = ? ORDER BY createdAt DESC LIMIT ${limit}`,
            [req.user.id]
        );
        return sendResponse(res, { status: 200, message: 'Shared note audit logs fetched', data: logs });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

module.exports = { getProfile, updatePassword, enable2FA, disable2FA, getAccountAuditLogs, getNoteAuditLogs, getSharedAuditLogs };
