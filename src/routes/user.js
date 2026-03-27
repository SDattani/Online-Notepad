const express = require('express');
const userRouter = express.Router();
const bcrypt = require('bcrypt');
const { getDB } = require("../config/database")

const { UserAuth } = require('../middleware/Auth');
const User = require('../models/user');
const { sendResponse } = require('../utils/response');
const Audit = require('../models/audit');

/**
 * @swagger
 * /user/view:
 *   get:
 *     summary: Get logged-in user profile
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile fetched successfully
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
 *                   example: User profile fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Sahil
 *                     lastName:
 *                       type: string
 *                       example: Dattani
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

userRouter.get("/user/view", UserAuth, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT firstName, lastName FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return sendResponse(res, {
                status: 404,
                message: 'User not found',
                data: null,
            });
        }

        return sendResponse(res, {
            status: 200,
            message: 'User profile fetched successfully',
            data: rows[0],
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
 * /user/password:
 *   patch:
 *     summary: Update password
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: Sah#2003
 *               newPassword:
 *                 type: string
 *                 example: Sah#2904
 *     responses:
 *       200:
 *         description: Password updated successfully
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
 *                   example: Sahil your password updated successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       400:
 *         description: Old and new password are required
 *       401:
 *         description: Invalid old password
 *       500:
 *         description: Server error
 */

userRouter.patch("/user/password", UserAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return sendResponse(res, {
                status: 400,
                message: 'Old password and new password are required',
                data: null,
            });
        }

        const isOldPasswordValid = await User.validatePassword(oldPassword, req.user.password);
        if (!isOldPasswordValid) {
            return sendResponse(res, {
                status: 401,
                message: 'Invalid old password',
                data: null,
            });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(req.user.id, newPasswordHash);

        await Audit.logUserAction(
            req.user.id,
            'PASSWORD_UPDATED',
            { passwordHash: req.user.password },
            { passwordHash: newPasswordHash }
        );

        return sendResponse(res, {
            status: 200,
            message: `${req.user.firstName} your password updated successfully`,
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

/**
 * @swagger
 * /user/2fa/enable:
 *   patch:
 *     summary: Enable 2FA for logged-in user
 *     description: Once enabled OTP will be required on every login.
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
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
 *                   example: 2FA enabled successfully. OTP will be required on next login.
 *                 data:
 *                   nullable: true
 *                   example: null
 *       400:
 *         description: 2FA is already enabled
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

userRouter.patch('/user/2fa/enable', UserAuth, async (req, res) => {
    try {
        if (req.user.isTwoFactorEnabled) {
            return sendResponse(res, {
                status: 400,
                message: '2FA is already enabled',
                data: null,
            });
        }

        await User.enableTwoFactor(req.user.id);

        await Audit.logUserAction(
            req.user.id,
            '2FA_ENABLED',
            { isTwoFactorEnabled: false },
            { isTwoFactorEnabled: true }
        );

        return sendResponse(res, {
            status: 200,
            message: '2FA enabled successfully. OTP will be required on next login.',
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

/**
 * @swagger
 * /user/2fa/disable:
 *   patch:
 *     summary: Disable 2FA for logged-in user
 *     description: Once disabled OTP will no longer be required on login.
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
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
 *                   example: 2FA disabled successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       400:
 *         description: 2FA is already disabled
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

userRouter.patch('/user/2fa/disable', UserAuth, async (req, res) => {
    try {
        if (!req.user.isTwoFactorEnabled) {
            return sendResponse(res, {
                status: 400,
                message: '2FA is already disabled',
                data: null,
            });
        }

        await User.disableTwoFactor(req.user.id);

        await Audit.logUserAction(
            req.user.id,
            '2FA_DISABLED',
            { isTwoFactorEnabled: true },
            { isTwoFactorEnabled: false }
        );

        return sendResponse(res, {
            status: 200,
            message: '2FA disabled successfully',
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

/**
 * @swagger
 * /user/audit-logs/account:
 *   get:
 *     summary: Get account activity audit logs
 *     description: Returns login, logout, signup, password change, and 2FA activity. Use ?limit=N to control results (max 100).
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *         description: Max number of records to return (default 50, max 100)
 *     responses:
 *       200:
 *         description: Account audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

userRouter.get('/user/audit-logs/account', UserAuth, async (req, res) => {
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
});

/**
 * @swagger
 * /user/audit-logs/notes:
 *   get:
 *     summary: Get note activity audit logs
 *     description: Returns created, updated, and deleted note history. Use ?limit=N to control results (max 100).
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *         description: Max number of records to return (default 50, max 100)
 *     responses:
 *       200:
 *         description: Note audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

userRouter.get('/user/audit-logs/notes', UserAuth, async (req, res) => {
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
});

/**
 * @swagger
 * /user/audit-logs/shared:
 *   get:
 *     summary: Get shared note activity audit logs
 *     description: Returns share, revoke, and permission change history. Use ?limit=N to control results (max 100).
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *         description: Max number of records to return (default 50, max 100)
 *     responses:
 *       200:
 *         description: Shared note audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

userRouter.get('/user/audit-logs/shared', UserAuth, async (req, res) => {
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
});

module.exports = userRouter;