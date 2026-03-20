const { permission } = require("process");
const { getDB } = require("../config/database");
const crypto = require('crypto');

const SharedNote = {

    create: async ({ noteId, ownerId, shareWithUserId, permission }) => {
        const db = getDB();

        const [existing] = await db.execute(
            `SELECT  * FROM shared_notes
            WHERE noteId = ? AND ownerId = ? AND sharedWithUserId = ? AND isActive = TRUE`,
            [noteId, ownerId, shareWithUserId]
        );

        if (existing.length > 0) {
            throw new Error('Note is already shared to this User!!');
        }

        const token = crypto.randomBytes(32).toString('hex');

        const [result] = await db.execute(
            `INSERT INTO shared_notes (noteId, ownerId, sharedWithUserId, token, permission)
            VALUES (?,?,?,?,?)`,
            [noteId, ownerId, sharedWithUserId, token, permission]
        );

        const [rows] = await db.execute(
            'SELECT * FROM shared_notes WHERE id = ?',
            [result.insertId]
        );

        return rows[0];
    },

    findByToken: async (token, accessingUserId) => {
        const db = getDB();
        const [rows] = await db.execute(
            `SELECT shared_notes.* , notes.title, notes.content , user.userId
            FROM shared_notes
            JOIN notes ON shared_notes.noteId = notes.id
            WHERE shared_notes.token = ?
            AND shared_notes.isActive = TRUE
            AND shared_notes.shareWithUserId = ?`,
            [token, accessingUserId]
        );
        return rows[0] || null;
    },

    findByNoteId: async (noteId, ownerId) => {
        const db = getDB();
        const [rows] = await db.execute(`
            SELECT shared_notes.*, users.firstName, users.lastName, users.emailId
            FROM shared_notes
            JOIN users ON shared_notes.sharedWithUserId = users.id
            WHERE shared_notes.noteId = ? AND shared_notes.ownerId = ?`,
            [noteId, ownerId]
        );
        return rows;
    },

    findSharedWithMe: async (userId) => {
        const db = getDB();
        const [rows] = db.execute(
            `SELECT shared_notes.*, notes.title, notes.content,
             users.firstName AS ownerFirstName, users.lastName AS ownerLastName
             FROM shared_notes
             JOIN notes ON shared_notes.noteId = notes.id
             JOIN users ON shared_notes.ownerId = users.id
             WHERE shared_notes.sharedWithUserId = ? AND shared_notes.isActive = TRUE`,
            [userId]
        );
        return rows;
    },

    revoke: async (token, ownerId) => {
        const db = getDB();
        const [result] = await db.execute(
            `UPDATE shared_notes SET isActive = FALSE
             WHERE token = ? AND ownerId = ?`,
            [token, ownerId]
        );
        return result.affectedRows > 0;
    },

    updatePermission: async (token, ownerId, permission) => {
        const db = getDB();
        const [result] = await db.execute(
            `UPDATE shared_notes SET permission = ?
             WHERE token = ? AND ownerId = ?`,
            [permission, token, ownerId]
        );
        return result.affectedRows > 0;
    },
};

module.exports = SharedNote;