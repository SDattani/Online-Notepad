/**
 * @swagger
 * components:
 *   schemas:
 *     ShareNote:
 *       type: object
 *       required: [userId, permission]
 *       properties:
 *         userId:
 *           type: integer
 *           example: 2
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
 *     EditSharedNote:
 *       type: object
 *       required: [content]
 *       properties:
 *         content:
 *           type: string
 *           example: Updated content by shared user
 */


const express = require('express');
const sharedRouter = express.Router();
const SharedNote = require('../models/sharedNotes');
const Note = require('../models/note');
const User = require('../models/user');
const { UserAuth } = require('../middleware/Auth');

/**
 * @swagger
 * /notes/{id}/share:
 *   post:
 *     summary: Share a note with a specific user
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
 *                 message:
 *                   type: string
 *                   example: Note shared with John Doe successfully
 *                 shareLink:
 *                   type: string
 *                   example: http://localhost:3000/shared/a1b2c3...
 *                 sharedWith:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                 permission:
 *                   type: string
 *                   enum: [view, edit]
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error or already shared
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note or user not found
 */
sharedRouter.post('/notes/:id/share', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const permission = req.body.permission?.toLowerCase();

        if (!userId) {
            return res.status(400).send('userId is required');
        }

        if (!permission || !['view', 'edit'].includes(permission)) {
            return res.status(400).send("Permission must be 'view' or 'edit'");
        }

        if (parseInt(userId) === req.user.id) {
            return res.status(400).send('You cannot share a note with yourself');
        }

        const note = await Note.findOne(id, req.user.id);
        if (!note) {
            return res.status(404).send('Note not found');
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).send('User to share with not found');
        }

        const shared = await SharedNote.create({
            noteId: id,
            ownerId: req.user.id,
            sharedWithUserId: userId,
            permission,
        });

        const shareLink = `${req.protocol}://${req.get('host')}/shared/${shared.token}`;

        res.status(201).json({
            message: `Note shared with ${targetUser.firstName} ${targetUser.lastName} successfully`,
            shareLink,
            sharedWith: {
                userId: targetUser.id,
                name: `${targetUser.firstName} ${targetUser.lastName}`,
                email: targetUser.emailId,
            },
            permission: shared.permission,
            token: shared.token,
        });
    }
    catch (err) {
        if (err.message === 'Note is already shared to this User!!') {
            return res.status(400).send(err.message);
        }
        return res.status(500).send('Error sharing note: ' + err.message);
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
 *         description: List of all shares for the note
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   token:
 *                     type: string
 *                   permission:
 *                     type: string
 *                     enum: [view, edit]
 *                   isActive:
 *                     type: boolean
 *                   shareLink:
 *                     type: string
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   emailId:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */
sharedRouter.get('/notes/:id/shares', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const note = await Note.findOne(id, req.user.id);
        if (!note) {
            return res.status(404).send('Note not found');
        }

        const shares = await SharedNote.findByNoteId(id, req.user.id);

        const sharesWithLinks = shares.map(share => ({
            ...share,
            shareLink: `${req.protocol}://${req.get('host')}/shared/${share.token}`,
        }));

        res.json(sharesWithLinks);
    } catch (err) {
        res.status(500).send('Error fetching shares: ' + err.message);
    }
});
/**
 * @swagger
 * /shared/{token}/permission:
 *   patch:
 *     summary: Update permission of a share link (owner only)
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
 *                 message:
 *                   type: string
 *                   example: Permission updated successfully
 *                 permission:
 *                   type: string
 *                   enum: [view, edit]
 *       400:
 *         description: Invalid permission value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 */
sharedRouter.patch('/shared/:token/permission', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const permission = req.body.permission?.toLowerCase();

        if (!permission || !['view', 'edit'].includes(permission)) {
            return res.status(400).send("Permission must be 'view' or 'edit'");
        }

        const updated = await SharedNote.updatePermission(token, req.user.id, permission);
        if (!updated) {
            return res.status(404).send('Share link not found or unauthorized');
        }

        res.json({ message: 'Permission updated successfully', permission });
    } catch (err) {
        res.status(500).send('Error updating permission: ' + err.message);
    }
});
/**
 * @swagger
 * /shared/{token}/revoke:
 *   delete:
 *     summary: Revoke a share link (owner only)
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
 *                 message:
 *                   type: string
 *                   example: Share link revoked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Share link not found or unauthorized
 */
sharedRouter.delete('/shared/:token/revoke', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;

        const revoked = await SharedNote.revoke(token, req.user.id);
        if (!revoked) {
            return res.status(404).send('Share link not found or unauthorized');
        }

        res.json({ message: 'Share link revoked successfully' });
    } catch (err) {
        res.status(500).send('Error revoking share: ' + err.message);
    }
});
/**
 * @swagger
 * /notes/shared-with-me:
 *   get:
 *     summary: Get all notes shared with the logged-in user
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of notes shared with me
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   permission:
 *                     type: string
 *                     enum: [view, edit]
 *                   shareLink:
 *                     type: string
 *                   ownerFirstName:
 *                     type: string
 *                   ownerLastName:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */
sharedRouter.get('/notes/shared-with-me', UserAuth, async (req, res) => {
    try {
        const notes = await SharedNote.findSharedWithMe(req.user.id);

        const notesWithLinks = notes.map(note => ({
            ...note,
            shareLink: `${req.protocol}://${req.get('host')}/shared/${note.token}`,
        }));

        res.json(notesWithLinks);
    } catch (err) {
        res.status(500).send('Error fetching shared notes: ' + err.message);
    }
});
/**
 * @swagger
 * /shared/{token}:
 *   get:
 *     summary: Access a shared note via link (shared user only)
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Share token from the share link
 *     responses:
 *       200:
 *         description: Shared note content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 permission:
 *                   type: string
 *                   enum: [view, edit]
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No access or link revoked
 */
sharedRouter.get('/shared/:token', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;

        // findByToken checks both token AND userId match
        const shared = await SharedNote.findByToken(token, req.user.id);

        if (!shared) {
            return res.status(403).send('You do not have access to this note or link has been revoked');
        }

        res.json({
            title: shared.title,
            content: shared.content,
            permission: shared.permission,
            message: shared.permission === 'edit'
                ? 'You can edit the content of this note'
                : 'You can view this note only',
        });
    } catch (err) {
        res.status(500).send('Error accessing shared note: ' + err.message);
    }
});
/**
 * @swagger
 * /shared/{token}:
 *   patch:
 *     summary: Edit content of a shared note (edit permission only, title is protected)
 *     tags: [Sharing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Share token from the share link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditSharedNote'
 *     responses:
 *       200:
 *         description: Note content updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Note content updated successfully
 *       400:
 *         description: Content is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: View only permission or link revoked
 */
sharedRouter.patch('/shared/:token', UserAuth, async (req, res) => {
    try {
        const { token } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).send('Content is required');
        }

        // Validate token AND userId match
        const shared = await SharedNote.findByToken(token, req.user.id);
        if (!shared) {
            return res.status(403).send('You do not have access to this note or link has been revoked');
        }

        // Check edit permission
        if (shared.permission !== 'edit') {
            return res.status(403).send('You only have view permission on this note');
        }

        // Update only content — title is never touched
        const db = require('../config/database').getDB();
        await db.execute(
            'UPDATE notes SET content = ? WHERE id = ?',
            [content, shared.noteId]
        );

        res.json({ message: 'Note content updated successfully' });
    } catch (err) {
        res.status(500).send('Error updating shared note: ' + err.message);
    }
});

module.exports = sharedRouter;