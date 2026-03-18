const express = require('express');
const noteRouter = express.Router();
const Note = require('../models/note');
const mongoose = require('mongoose');

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
        // console.log('req.user:', req.user); // add this
        // console.log('req.cookies:', req.cookies);
        const { title, content } = req.body;
        if (!title) {
            return res.status(400).send('Title is required !!');
        }

        const note = new Note({
            title,
            content,
            userId: req.user._id,
        });

        await note.save();

        res.json(note);
    }
    catch (err) {
        res.status(500).send('Error While creating notes : ' + err.message);
    };
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
        const notes = await Note.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });
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
        const notes = await Note.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        res.json(notes);
    }
    catch (err) {
        res.status(400).send('Error fetching notes : ' + err.message);
    };
});

noteRouter.patch('/notes/:id', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send('Note Id Required!!');
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('Invalid Note Id')
        }

        const { title, content } = req.body;

        const updates = {};
        if (title !== undefined) {
            updates.title = title;
        }
        if (content !== undefined) {
            updates.content = content;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).send('No Fields providedto update')
        }

        const note = await Note.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            updates,
            { new: true, runValidators: true }
        );

        if (!note) {
            return res.status(404).send('Note not found');
        }
        res.json(note);
    }
    catch (err) {
        res.status(500).send('Error updating note : ' + err.message);
    }
});

noteRouter.delete('/notes/:id', UserAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send('Note Id Required!!');
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('Invalid Note Id')
        }

        const note = await Note.findOneAndDelete({
            _id : req.params.id,
            userId : req.user._id,
        });
        if (!note) {
            return res.status(404).send('Note not found');
        }
        res.send('Note deleted successfully');
    }
    catch (err) {
        res.status(500).send('Error deleting note : ' + err.message);
    }
});

module.exports = noteRouter;