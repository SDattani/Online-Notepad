/**
 * @swagger
 * components:
 *   schemas:
 *     ShareNote:
 *       type: object
 *       required: [emailId, permission]
 *       properties:
 *         emailId:
 *           type: string
 *           example: john@gmail.com
 *         permission:
 *           type: string
 *           enum: [view, edit]
 *           example: view
 *     UpdatePermission:
 *       type: object
 *       required: [permission]
 *       properties:
 *         permission:
 *           type: string
 *           enum: [view, edit]
 *           example: edit
 */

const express = require('express');
const sharedRouter = express.Router();
const { UserAuth } = require('../middleware/Auth');
const { shareNote, getSharesForNote, updateSharePermission, revokeShare } = require('../controllers/sharedController');

/**
 * @swagger
 * /api/v1/notes/{id}/share:
 *   post:
 *     summary: Share a note with a specific user by email
 *     description: Owner shares note by email. Permission is view or edit.
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShareNote'
 *     responses:
 *       201:
 *         description: Note shared successfully
 *       400:
 *         description: Invalid note ID, email, permission, already shared, or sharing with yourself
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found or no user found with this email
 *       500:
 *         description: Server error
 */
sharedRouter.post('/api/v1/notes/:id/share', UserAuth, shareNote);

/**
 * @swagger
 * /api/v1/notes/{id}/shares:
 *   get:
 *     summary: Get all share links for a note (owner only)
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Shares fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *       500:
 *         description: Server error
 */
sharedRouter.get('/api/v1/notes/:id/shares', UserAuth, getSharesForNote);

/**
 * @swagger
 * /shared/{token}/permission:
 *   patch:
 *     summary: Update permission of a share link (owner only)
 *     description: Switch permission between view and edit at any time.
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePermission'
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       400:
 *         description: Invalid permission value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 *       500:
 *         description: Server error
 */
sharedRouter.patch('/api/v1/shared/:token/permission', UserAuth, updateSharePermission);

/**
 * @swagger
 * /api/v1/shared/{token}/revoke:
 *   delete:
 *     summary: Revoke a share link (owner only)
 *     description: Once revoked the shared user can no longer access the note.
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Share link revoked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 *       500:
 *         description: Server error
 */
sharedRouter.delete('/api/v1/shared/:token/revoke', UserAuth, revokeShare);

module.exports = sharedRouter;
