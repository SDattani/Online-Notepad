const express = require('express');
const noteRouter = express.Router();
const Note = require('../models/note');
const mongoose = require('mongoose');

const { UserAuth } = require('../middleware/Auth');

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