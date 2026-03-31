const express = require('express');
const noteRouter = express.Router();
const Note = require('../models/note');
const SharedNote = require('../models/sharedNotes');

const { getDB } = require('../config/database')
const { sendResponse } = require('../utils/response');
const { UserAuth } = require('../middleware/Auth');
const createShareLink = require('../utils/createShareLink');
const Audit = require('../models/audit');

/**
 * @swagger
 * /notes:
 *   post:
 *     summary: Create a new note
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: My First Note
 *               content:
 *                 type: string
 *                 example: This is my note content
 *     responses:
 *       201:
 *         description: Note created successfully
 *       400:
 *         description: Title is required or exceeds limit
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all own notes and shared notes
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Notes fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

noteRouter.post('/notes', UserAuth, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || title.trim() === '') {
            return sendResponse(res, { status: 400, message: 'Title is required', data: null });
        }
        if (title.length > 200) {
            return sendResponse(res, { status: 400, message: 'Title cannot exceed 200 characters', data: null });
        }
        if (content && content.length > 50000) {
            return sendResponse(res, { status: 400, message: 'Content cannot exceed 50000 characters', data: null });
        }

        const note = await Note.create({ title: title.trim(), content, userId: req.user.id });

        await Audit.logNoteAction(
            req.user.id,
            note.id,
            'NOTE_CREATED',
            null,
            { title: note.title, content: note.content }
        );

        return sendResponse(res, {
            status: 201,
            message: 'Note created successfully',
            data: note,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

noteRouter.get('/notes', UserAuth, async (req, res) => {
    try {
        const db = getDB();

        const [ownNotes] = await db.execute(
            `SELECT *, 'owner' AS role FROM notes WHERE userId = ? ORDER BY updatedAt DESC`,
            [req.user.id]
        );

        const [sharedNotes] = await db.execute(
            `SELECT notes.*, shared_notes.permission, shared_notes.token,
             'shared' AS role,
             users.firstName AS ownerFirstName,
             users.lastName AS ownerLastName
             FROM shared_notes
             JOIN notes ON shared_notes.noteId = notes.id
             JOIN users ON shared_notes.ownerId = users.id
             WHERE shared_notes.sharedWithUserId = ?
             AND shared_notes.isActive = TRUE
             ORDER BY notes.updatedAt DESC`,
            [req.user.id]
        );

        const sharedWithLinks = sharedNotes.map(note => ({
            ...note,
            shareLink: createShareLink(note.token),
        }));

        await Audit.logNoteAction(req.user.id, null, 'NOTES_VIEWED', null, { ownNotes , sharedWithLinks});

        return sendResponse(res, {
            status: 200,
            message: 'Notes fetched successfully',
            data: {
                ownNotes,
                sharedNotes: sharedWithLinks,
            },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /notes/shared-with-me:
 *   get:
 *     summary: Get all notes shared with the logged-in user
 *     description: Must be placed before /notes/{id} route to avoid route conflict.
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Shared notes fetched successfully
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
 *                   example: Shared notes fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: Shopping List
 *                       content:
 *                         type: string
 *                         example: Milk, Eggs, Bread
 *                       permission:
 *                         type: string
 *                         enum: [view, edit]
 *                         example: view
 *                       token:
 *                         type: string
 *                         example: a1b2c3d4e5f6...
 *                       shareLink:
 *                         type: string
 *                         example: http://localhost:5173/notes/1
 *                       ownerFirstName:
 *                         type: string
 *                         example: Sahil
 *                       ownerLastName:
 *                         type: string
 *                         example: Dattani
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

noteRouter.get('/notes/shared-with-me', UserAuth, async (req, res) => {
    try {
        const notes = await SharedNote.findSharedWithMe(req.user.id);
        const notesWithLinks = notes.map(note => ({
            ...note,
            shareLink: createShareLink(note.token),
        }));

        return sendResponse(res, {
            status: 200,
            message: 'Shared notes fetched successfully',
            data: notesWithLinks,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /notes/{id}:
 *   get:
 *     summary: Get a note by ID — works for both owner and shared user
 *     description: Owner gets full access. Shared user gets note based on their permission level.
 *     tags: [Notes]
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
 *         description: Note fetched successfully
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
 *                   example: Note fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: My First Note
 *                     content:
 *                       type: string
 *                       example: This is my note
 *                     role:
 *                       type: string
 *                       enum: [owner, shared]
 *                       example: owner
 *                     permission:
 *                       type: string
 *                       enum: [view, edit]
 *                       example: edit
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: You do not have access to this note
 *       404:
 *         description: Note not found
 *   patch:
 *     summary: Update a note — owner can update title and content, shared user can only update content
 *     description: Owner can update both title and content. Shared user with edit permission can only update content. Title is always protected for shared users.
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the note
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Title
 *               content:
 *                 type: string
 *                 example: Updated content
 *     responses:
 *       200:
 *         description: Note updated successfully
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
 *                   example: Note updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: Updated Title
 *                     content:
 *                       type: string
 *                       example: Updated content
 *                     role:
 *                       type: string
 *                       enum: [owner, shared]
 *                       example: owner
 *       400:
 *         description: No fields provided or content required for shared user
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No access or view only permission
 *       404:
 *         description: Note not found
 *   delete:
 *     summary: Delete a note (owner only)
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the note to delete
 *     responses:
 *       200:
 *         description: Note deleted successfully
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
 *                   example: Note deleted successfully
 *                 data:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */

noteRouter.get('/notes/:id', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const note = await Note.findOne(id, req.user.id);
        if (note) {
            await Audit.logNoteAction(req.user.id, parseInt(id), 'NOTE_VIEWED', null, null);

            return sendResponse(res, {
                status: 200,
                message: 'Note fetched successfully',
                data: { ...note, role: 'owner', permission: 'edit' },
            });
        }

        const db = getDB();
        const [sharedRows] = await db.execute(
            `SELECT notes.*, shared_notes.permission, shared_notes.token,
             'shared' AS role,
             users.firstName AS ownerFirstName,
             users.lastName AS ownerLastName
             FROM shared_notes
             JOIN notes ON shared_notes.noteId = notes.id
             JOIN users ON shared_notes.ownerId = users.id
             WHERE notes.id = ?
             AND shared_notes.sharedWithUserId = ?
             AND shared_notes.isActive = TRUE`,
            [id, req.user.id]
        );


        if (sharedRows.length > 0) {
            await Audit.logNoteAction(req.user.id, parseInt(id), 'NOTE_VIEWED_AS_SHARED', null, null);
            return sendResponse(res, {
                status: 200,
                message: sharedRows[0].permission === 'edit'
                    ? 'You can edit the content of this note'
                    : 'You can view this note only',
                data: sharedRows[0],
            });
        }

        return sendResponse(res, {
            status: 403,
            message: 'You do not have access to this note',
            data: null,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

noteRouter.patch('/notes/:id', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const note = await Note.findOne(id, req.user.id);

        if (note) {
            const updates = {};
            if (title !== undefined) updates.title = title;
            if (content !== undefined) updates.content = content;

            if (Object.keys(updates).length === 0) {
                return sendResponse(res, { status: 400, message: 'No fields provided to update', data: null });
            }

            const updatedNote = await Note.update(id, req.user.id, updates);

            await Audit.logNoteAction(
                req.user.id,
                id,
                'NOTE_UPDATED',
                { title: note.title, content: note.content },            // previousData
                { title: updatedNote.title, content: updatedNote.content } // newData
            );

            return sendResponse(res, {
                status: 200,
                message: 'Note updated successfully',
                data: { ...updatedNote, role: 'owner' },
            });
        }

        const db = getDB();
        const [sharedRows] = await db.execute(
            `SELECT shared_notes.*, notes.title, notes.content
             FROM shared_notes
             JOIN notes ON shared_notes.noteId = notes.id
             WHERE notes.id = ?
             AND shared_notes.sharedWithUserId = ?
             AND shared_notes.isActive = TRUE`,
            [id, req.user.id]
        );

        if (sharedRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'You do not have access to this note', data: null });
        }

        if (sharedRows[0].permission !== 'edit') {
            return sendResponse(res, { status: 403, message: 'You only have view permission on this note', data: null });
        }

        if (!content) {
            return sendResponse(res, { status: 400, message: 'Content is required', data: null });
        }

        await db.execute('UPDATE notes SET content = ? WHERE id = ?', [content, id]);
        const [updatedRows] = await db.execute('SELECT * FROM notes WHERE id = ?', [id]);

        await Audit.logNoteAction(
            req.user.id,
            id,
            'NOTE_UPDATED_BY_SHARED_USER',
            { content: sharedRows[0].content },    // previousData (old content)
            { content: updatedRows[0].content }    // newData (new content)
        );

        return sendResponse(res, {
            status: 200,
            message: 'Note content updated successfully',
            data: { ...updatedRows[0], role: 'shared' },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

noteRouter.delete('/notes/:id', UserAuth, async (req, res) => {
    try {
        const note = await Note.findOne(req.params.id, req.user.id);
        if (!note) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        const deleted = await Note.delete(req.params.id, req.user.id);
        if (!deleted) {
            return sendResponse(res, { status: 404, message: 'Note not found', data: null });
        }

        await Audit.logNoteAction(
            req.user.id,
            req.params.id,
            'NOTE_DELETED',
            { title: note.title, content: note.content },
            null
        );

        return sendResponse(res, {
            status: 200,
            message: 'Note deleted successfully',
            data: null,
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

module.exports = noteRouter;