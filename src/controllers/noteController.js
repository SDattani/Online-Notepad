const Note = require('../models/note');
const SharedNote = require('../models/sharedNotes');
const Audit = require('../models/audit');
const { getDB } = require('../config/database');
const { sendResponse } = require('../utils/response');
const createShareLink = require('../utils/createShareLink');

const createNote = async (req, res) => {
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

        await Audit.logNoteAction(req.user.id, note.id, 'NOTE_CREATED', null, { title: note.title, content: note.content });

        return sendResponse(res, { status: 201, message: 'Note created successfully', data: note });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getAllNotes = async (req, res) => {
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

        await Audit.logNoteAction(req.user.id, null, 'NOTES_VIEWED', null, null);

        return sendResponse(res, {
            status: 200,
            message: 'Notes fetched successfully',
            data: { ownNotes, sharedNotes: sharedWithLinks },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getSharedWithMe = async (req, res) => {
    try {
        const notes = await SharedNote.findSharedWithMe(req.user.id);
        const notesWithLinks = notes.map(note => ({
            ...note,
            shareLink: createShareLink(note.token),
        }));
        return sendResponse(res, { status: 200, message: 'Shared notes fetched successfully', data: notesWithLinks });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const getNoteById = async (req, res) => {
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

        return sendResponse(res, { status: 403, message: 'You do not have access to this note', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const updateNote = async (req, res) => {
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
                req.user.id, id, 'NOTE_UPDATED',
                { title: note.title, content: note.content },
                { title: updatedNote.title, content: updatedNote.content }
            );

            return sendResponse(res, { status: 200, message: 'Note updated successfully', data: { ...updatedNote, role: 'owner' } });
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
            req.user.id, id, 'NOTE_UPDATED_BY_SHARED_USER',
            { content: sharedRows[0].content },
            { content: updatedRows[0].content }
        );

        return sendResponse(res, { status: 200, message: 'Note content updated successfully', data: { ...updatedRows[0], role: 'shared' } });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

const deleteNote = async (req, res) => {
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
            req.user.id, req.params.id, 'NOTE_DELETED',
            { title: note.title, content: note.content },
            null
        );

        return sendResponse(res, { status: 200, message: 'Note deleted successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
};

module.exports = { createNote, getAllNotes, getSharedWithMe, getNoteById, updateNote, deleteNote };
