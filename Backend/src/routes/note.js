const express = require('express');
const noteRouter = express.Router();
const { UserAuth } = require('../middleware/Auth');
const { createNote, getAllNotes, getSharedWithMe, getNoteById, updateNote, deleteNote } = require('../controllers/noteController');
noteRouter.use(UserAuth);
/**
 * @swagger
 * /api/v1/notes:
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
noteRouter.post('/api/v1/notes', UserAuth, createNote);
noteRouter.get('/api/v1/notes', UserAuth, getAllNotes);

/**
 * @swagger
 * /api/v1/notes/shared-with-me:
 *   get:
 *     summary: Get all notes shared with the logged-in user
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Shared notes fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
noteRouter.get('/api/v1/notes/shared-with-me', UserAuth, getSharedWithMe);

/**
 * @swagger
 * /api/v1/notes/{id}:
 *   get:
 *     summary: Get a note by ID
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
 *     responses:
 *       200:
 *         description: Note fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: You do not have access to this note
 *       404:
 *         description: Note not found
 *   patch:
 *     summary: Update a note
 *     description: Owner can update title and content. Shared user with edit permission can only update content.
 *     tags: [Notes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *     responses:
 *       200:
 *         description: Note deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 */
noteRouter.get('/api/v1/notes/:id', UserAuth, getNoteById);
noteRouter.patch('/api/v1/notes/:id', UserAuth, updateNote);
noteRouter.delete('/api/v1/notes/:id', UserAuth, deleteNote);

module.exports = noteRouter;
