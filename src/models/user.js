const { getDB } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = {

    findByEmail: async (emailId) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE emailId = ?', [emailId.toLowerCase()]
        );
        return rows[0] || null;
    },

    findById: async (id) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE id = ?', [id]
        );
        return rows[0] || null;
    },

    create: async ({ firstName, lastName, emailId, password }) => {
        const db = getDB();
        const [result] = await db.execute(
            'INSERT INTO users (firstName, lastName, emailId, password) VALUES (?, ?, ?, ?)',
            [firstName, lastName, emailId.toLowerCase(), password]
        );
        return { id: result.insertId, firstName, lastName, emailId };
    },

    updatePassword: async (id, newPasswordHash) => {
        const db = getDB();
        await db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [newPasswordHash, id]
        );
    },

    generateToken: (user) => {
        return jwt.sign({ _id: user.id }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });
    },

    validatePassword: async (inputPassword, storedHash) => {
        return await bcrypt.compare(inputPassword, storedHash);
    },

    enableTwoFactor: async (id) => {
        const db = getDB();
        await db.execute(
            'UPDATE users SET isTwoFactorEnabled = TRUE WHERE id = ?',
            [id]
        );
    },

    disableTwoFactor: async (id) => {
        const db = getDB();
        await db.execute(
            'UPDATE users SET isTwoFactorEnabled = FALSE WHERE id = ?',
            [id]
        );
    },
};

module.exports = User;

