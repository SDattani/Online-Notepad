const express = require('express');
const noteRouter = express.Router();
const Note = require('../models/note');

const { getDB } = require('../config/database')

const { UserAuth } = require('../middleware/Auth');

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
 *                 example: Hello world
 *     responses:
 *       201:
 *         description: Note created successfully
 *       400:
 *         description: Title is required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error creating note
 */

noteRouter.post('/notes', UserAuth, async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).send('Title is required');
        }
        if (title.length > 200) {
            return res.status(400).send('Title cannot exceed 200 characters');
        }
        if (content && content.length > 50000) {
            return res.status(400).send('Content cannot exceed 50000 characters');
        }

        const note = await Note.create({
            title: title.trim(),
            content,
            userId: req.user.id,   // MySQL uses id not _id
        });
        res.status(201).json(note);
    } catch (err) {
        res.status(500).send('Error creating note: ' + err.message);
    }
});

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Get all own notes and shared notes
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Own notes and shared notes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ownNotes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: My First Note
 *                       content:
 *                         type: string
 *                         example: This is my note
 *                       userId:
 *                         type: integer
 *                         example: 1
 *                       role:
 *                         type: string
 *                         example: owner
 *                       createdAt:
 *                         type: string
 *                         example: 2026-03-18T00:00:00.000Z
 *                       updatedAt:
 *                         type: string
 *                         example: 2026-03-18T00:00:00.000Z
 *                 sharedNotes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 2
 *                       title:
 *                         type: string
 *                         example: John's Note
 *                       content:
 *                         type: string
 *                         example: Shared with me
 *                       userId:
 *                         type: integer
 *                         example: 2
 *                       role:
 *                         type: string
 *                         example: shared
 *                       permission:
 *                         type: string
 *                         enum: [view, edit]
 *                         example: edit
 *                       token:
 *                         type: string
 *                         example: a1b2c3...
 *                       shareLink:
 *                         type: string
 *                         example: http://localhost:3000/shared/a1b2c3...
 *                       ownerFirstName:
 *                         type: string
 *                         example: John
 *                       ownerLastName:
 *                         type: string
 *                         example: Doe
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error fetching notes
 */

noteRouter.get('/notes', UserAuth, async (req, res) => {
    try {
        const db = getDB();

        const [ownNotes] = await db.execute(
            `SELECT *, 'owner' AS role FROM notes 
             WHERE userId = ? 
             ORDER BY updatedAt DESC`,
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
            shareLink: `${req.protocol}://${req.get('host')}/shared/${note.token}`,
        }));

        res.json({
            ownNotes,
            sharedNotes: sharedWithLinks,
        });

    }
    catch (err) {
        res.status(400).send('Error fetching notes : ' + err.message);
    };
});

/**
 * @swagger
 * /notes/{id}:
 *   get:
 *     summary: Get a note by ID
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
 *         description: Note found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 title:
 *                   type: string
 *                   example: My First Note
 *                 content:
 *                   type: string
 *                   example: This is my note
 *                 userId:
 *                   type: integer
 *                   example: 1
 *                 createdAt:
 *                   type: string
 *                   example: 2026-03-18T00:00:00.000Z
 *                 updatedAt:
 *                   type: string
 *                   example: 2026-03-18T00:00:00.000Z
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *   patch:
 *     summary: Update a note (only send fields you want to update)
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
 *       400:
 *         description: No fields provided to update or invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *   delete:
 *     summary: Delete a note
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
 *       400:
 *         description: Invalid note ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */

noteRouter.get('/notes/:id', UserAuth, async (req, res) => {
    try {
        const notes = await Note.findOne(req.params.id, req.user.id);
        if (!notes) {
            return res.status(404).send("Note not found");
        }
        res.json(notes);
    }
    catch (err) {
        res.status(400).send('Error fetching notes : ' + err.message);
    };
});

noteRouter.patch('/notes/:id', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;

        if (Object.keys(updates).length === 0) {
            return res.status(400).send('No fields provided to update');
        }

        const note = await Note.update(id, req.user.id, updates);
        if (!note) return res.status(404).send('Note not found');
        res.json(note);
    }
    catch (err) {
        res.status(500).send('Error updating note : ' + err.message);
    }
});

noteRouter.delete('/notes/:id', UserAuth, async (req, res) => {
    try {
        const deleted = await Note.delete(req.params.id, req.user.id);
        if (!deleted) return res.status(404).send('Note not found');
        res.send('Note deleted successfully');
    }
    catch (err) {
        res.status(500).send('Error deleting note : ' + err.message);
    }
});

module.exports = noteRouter;