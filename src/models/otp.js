const { getDB } = require('../config/database');
const crypto = require('crypto');

const OTP = {

    create: async (userId) => {
        const db = getDB();

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const tempToken = crypto.randomBytes(32).toString('hex');

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.execute(
            'DELETE FROM otps WHERE userId = ? AND isUsed = FALSE',
            [userId]
        );

        await db.execute(
            `INSERT INTO otps (userId, otp, tempToken, expiresAt)
             VALUES (?, ?, ?, ?)`,
            [userId, otp, tempToken, expiresAt]
        );

        return { otp, tempToken };
    },

    verify: async (tempToken, otp) => {
        const db = getDB();

        const [rows] = await db.execute(
            `SELECT * FROM otps
             WHERE tempToken = ?
             AND otp = ?
             AND isUsed = FALSE
             AND expiresAt > NOW()`,
            [tempToken, otp]
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