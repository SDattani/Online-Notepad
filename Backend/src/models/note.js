// const mongoose = require('mongoose');

// const noteSchema = new mongoose.Schema({
//     title : {
//         type : String,
//         required : true,
//         trim : true,
//         maxLength : 200,
//     },
//     content : {
//         type : String,
//         default : '',
//         maxLength : 50000,
//     }, 
//     userId : {
//         type : mongoose.Schema.Types.ObjectId,
//         ref : 'User',
//         required : true,
//     },
// },
// {
//     timestamps : true,
// });

// const Note = mongoose.model('Note', noteSchema);
// module.exports = Note;

const { getDB } = require('../config/database');

const Note = {

    // Create note
    create: async ({ title, content, userId }) => {
        const db = getDB();
        const [result] = await db.execute(
            'INSERT INTO notes (title, content, userId) VALUES (?, ?, ?)',
            [title, content || '', userId]
        );
        const [rows] = await db.execute(
            'SELECT * FROM notes WHERE id = ?', [result.insertId]
        );
        return rows[0];
    },

    // Get all notes of a user
    findAllByUser: async (userId) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM notes WHERE userId = ? ORDER BY updatedAt DESC',
            [userId]
        );
        return rows;
    },

    // Get single note by id and userId
    findOne: async (id, userId) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM notes WHERE id = ? AND userId = ?',
            [id, userId]
        );
        return rows[0] || null;
    },

    // Update note
    update: async (id, userId, updates) => {
        const db = getDB();
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id, userId];
        await db.execute(
            `UPDATE notes SET ${fields} WHERE id = ? AND userId = ?`,
            values
        );
        const [rows] = await db.execute(
            'SELECT * FROM notes WHERE id = ?', [id]
        );
        return rows[0] || null;
    },

    // Delete note
    delete: async (id, userId) => {
        const db = getDB();
        const [result] = await db.execute(
            'DELETE FROM notes WHERE id = ? AND userId = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    },
};

module.exports = Note;