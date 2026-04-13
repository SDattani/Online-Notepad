const express = require('express');
const userRouter = express.Router();
const { UserAuth } = require('../middleware/Auth');
const {
    getProfile,
    updatePassword,
    enable2FA,
    disable2FA,
    getAccountAuditLogs,
    getNoteAuditLogs,
    getSharedAuditLogs,
} = require('../controllers/userController');

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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
userRouter.get('/user/view', UserAuth, getProfile);

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
 *       400:
 *         description: Old and new password are required
 *       401:
 *         description: Invalid old password
 *       500:
 *         description: Server error
 */
userRouter.patch('/user/password', UserAuth, updatePassword);

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
 *       400:
 *         description: 2FA is already enabled
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userRouter.patch('/user/2fa/enable', UserAuth, enable2FA);

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
 *       400:
 *         description: 2FA is already disabled
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userRouter.patch('/user/2fa/disable', UserAuth, disable2FA);

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
 *     responses:
 *       200:
 *         description: Account audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userRouter.get('/user/audit-logs/account', UserAuth, getAccountAuditLogs);

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
 *     responses:
 *       200:
 *         description: Note audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userRouter.get('/user/audit-logs/notes', UserAuth, getNoteAuditLogs);

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
 *     responses:
 *       200:
 *         description: Shared note audit logs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
userRouter.get('/user/audit-logs/shared', UserAuth, getSharedAuditLogs);

module.exports = userRouter;
