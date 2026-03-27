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
const SharedNote = require('../models/sharedNotes');
const Note = require('../models/note');
const User = require('../models/user');
const { UserAuth } = require('../middleware/Auth');
const validator = require('validator');
const { sendResponse } = require('../utils/response');
const createShareLink = require('../utils/createShareLink');
const Audit = require('../models/audit');

/**
 * @swagger
 * /notes/{id}/share:
 *   post:
 *     summary: Share a note with a specific user by email
 *     description: Owner shares note by email. Permission is view or edit. Title can never be edited by shared user.
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the note to share
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShareNote'
 *     responses:
 *       201:
 *         description: Note shared successfully
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
 *                   example: Note shared with John Doe successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     shareLink:
 *                       type: string
 *                       example: http://localhost:5173/notes/1
 *                     sharedWith:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: John Doe
 *                         email:
 *                           type: string
 *                           example: john@gmail.com
 *                     permission:
 *                       type: string
 *                       enum: [view, edit]
 *                       example: view
 *                     token:
 *                       type: string
 *                       example: a1b2c3d4e5f6...
 *       400:
 *         description: Invalid note ID, invalid email, invalid permission, already shared, or sharing with yourself
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found or no user found with this email
 *       500:
 *         description: Server error
 */

sharedRouter.post('/notes/:id/share', UserAuth, async (req, res) => {
    try {
        const noteId = parseInt(req.params.id);
        const permission = req.body.permission?.toLowerCase();
        const ownerId = req.user.id;
        const emailId = req.body.emailId?.toLowerCase().trim();
        const validator = require('validator');

        if (!noteId || isNaN(noteId)) {
            return sendResponse(res, { status: 400, message: 'Invalid note ID', data: null });
        }
        if (!emailId) {
            return sendResponse(res, { status: 400, message: 'emailId is required', data: null });
        }
        if (!validator.isEmail(emailId)) {
            return sendResponse(res, { status: 400, message: 'Invalid email address', data: null });
        }
        if (emailId === req.user.emailId.toLowerCase()) {
            return sendResponse(res, { status: 400, message: 'You cannot share a note with yourself', data: null });
        }
        if (!permission || !['view', 'edit'].includes(permission)) {
            return sendResponse(res, { status: 400, message: "Permission must be 'view' or 'edit'", data: null });
        }

        const note = await Note.findOne(noteId, ownerId);
        if (!note) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        const targetUser = await User.findByEmail(emailId);
        if (!targetUser) {
            return sendResponse(res, { status: 404, message: 'No user found with this email', data: null });
        }

        const shared = await SharedNote.create({ noteId, ownerId, sharedWithUserId: targetUser.id, permission });

        await Audit.logSharedNoteAction(
            ownerId, 
            noteId, 
            'NOTE_SHARED', 
            null, 
            { sharedWithEmail: targetUser.emailId, permission: shared.permission } // newData
        );

        return sendResponse(res, {
            status: 201,
            message: `Note shared with ${targetUser.firstName} ${targetUser.lastName} successfully`,
            data: {
                shareLink: createShareLink(shared.token),
                sharedWith: {
                    name: `${targetUser.firstName} ${targetUser.lastName}`,
                    email: targetUser.emailId,
                },
                permission: shared.permission,
                token: shared.token,
            },
        });
    } catch (err) {
        if (err.message === 'Note is already shared to this User!!') {
            return sendResponse(res, { status: 400, message: err.message, data: null });
        }
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /notes/{id}/shares:
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
 *         description: ID of the note
 *     responses:
 *       200:
 *         description: Shares fetched successfully
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
 *                   example: Shares fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       token:
 *                         type: string
 *                         example: a1b2c3d4e5f6...
 *                       permission:
 *                         type: string
 *                         enum: [view, edit]
 *                         example: view
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                       shareLink:
 *                         type: string
 *                         example: http://localhost:5173/notes/1
 *                       firstName:
 *                         type: string
 *                         example: John
 *                       lastName:
 *                         type: string
 *                         example: Doe
 *                       emailId:
 *                         type: string
 *                         example: john@gmail.com
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *       500:
 *         description: Server error
 */

sharedRouter.get('/notes/:id/shares', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const note = await Note.findOne(id, req.user.id);
        if (!note) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        const shares = await SharedNote.findByNoteId(id, req.user.id);
        const sharesWithLinks = shares.map(share => ({
            ...share,
            shareLink: createShareLink(share.token),
        }));

        return sendResponse(res, {
            status: 200,
            message: 'Shares fetched successfully',
            data: sharesWithLinks,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

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
 *         description: Share token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePermission'
 *     responses:
 *       200:
 *         description: Permission updated successfully
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
 *                   example: Permission updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     permission:
 *                       type: string
 *                       enum: [view, edit]
 *                       example: edit
 *       400:
 *         description: Invalid permission value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 *       500:
 *         description: Server error
 */

sharedRouter.patch('/shared/:token/permission', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const permission = req.body.permission?.toLowerCase();

        if (!permission || !['view', 'edit'].includes(permission)) {
            return sendResponse(res, { status: 400, message: "Permission must be 'view' or 'edit'", data: null });
        }

        const existingShare = await SharedNote.findByTokenForOwner(token, req.user.id);

        if (!existingShare) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        const updated = await SharedNote.updatePermission(token, req.user.id, permission);
        if (!updated) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        await Audit.logSharedNoteAction(
            req.user.id, 
            existingShare.noteId, 
            'SHARE_PERMISSION_UPDATED', 
            { permission: existingShare.permission }, // previousData
            { permission: permission }                // newData
        );

        return sendResponse(res, {
            status: 200,
            message: 'Permission updated successfully',
            data: { permission },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /shared/{token}/revoke:
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
 *         description: Share token to revoke
 *     responses:
 *       200:
 *         description: Share link revoked successfully
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
 *                   example: Share link revoked successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 *       500:
 *         description: Server error
 */

sharedRouter.delete('/shared/:token/revoke', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;

        const existingShare = await SharedNote.findByTokenForOwner(token, req.user.id);

        if (!existingShare) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        const revoked = await SharedNote.revoke(token, req.user.id);
        if (!revoked) {
            return sendResponse(res, { status: 404, message: 'Share link not found or unauthorized', data: null });
        }

        await Audit.logSharedNoteAction(
            req.user.id, 
            existingShare.noteId, 
            'SHARE_REVOKED', 
            { sharedWithUserId: existingShare.sharedWithUserId }, 
            { isActive: false }
        );

        return sendResponse(res, {
            status: 200,
            message: 'Share link revoked successfully',
            data: null,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

module.exports = sharedRouter;