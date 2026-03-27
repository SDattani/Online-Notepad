const { getDB } = require('../config/database');
const crypto = require('crypto');

const OTP = {

    create: async (userId) => {
        const db = getDB();

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.execute(
            'DELETE FROM otps WHERE userId = ? AND isUsed = FALSE',
            [userId]
        );

        await db.execute(
            `INSERT INTO otps (userId, otp, expiresAt)
             VALUES (?, ?, ?)`,
            [userId, otp, expiresAt]
        );

        return { otp };
    },

    verify: async (emailId , otp) => {
        const db = getDB();

        const [rows] = await db.execute(
            `SELECT otps.* FROM otps
             JOIN users ON otps.userId = users.id
             WHERE users.emailId = ?
             AND otps.otp = ?
             AND otps.isUsed = FALSE
             AND otps.expiresAt > NOW()`,
            [emailId.toLowerCase(), otp]
        );

        if (rows.length === 0) return null;

        await db.execute(
            'UPDATE otps SET isUsed = TRUE WHERE id = ?',
            [rows[0].id]
        );

        return rows[0];
    },

    deleteExpired: async () => {
    const db = getDB();
    const [result] = await db.execute(
        'DELETE FROM otps WHERE expiresAt < NOW() OR isUsed = TRUE'
    );
    console.log(`Cleaned up ${result.affectedRows} OTP(s)`);
},
};

module.exports = OTP;