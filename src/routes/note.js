const express = require('express');
const noteRouter = express.Router();
const Note = require('../models/note');

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
 *       200:
 *         description: Note created
 *       401:
 *         description: Unauthorized
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
 *     summary: Get all notes for logged-in user
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of notes
 */

noteRouter.get('/notes/:id', UserAuth, async (req, res) => {
    try {
        const note = await Note.findOne(req.params.id, req.user.id);
        if (!notes) {
            return res.status(404).send("Note not found");
        }
        res.json(notes);
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
 *           type: string
 *     responses:
 *       200:
 *         description: Note found
 *       404:
 *         description: Note not found
 *   patch:
 *     summary: Update a note
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Note updated
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
 *           type: string
 *     responses:
 *       200:
 *         description: Note deleted
 */

noteRouter.get('/notes', UserAuth, async (req, res) => {
    try {
        const notes = await Note.findAllByUser(req.user.id);
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