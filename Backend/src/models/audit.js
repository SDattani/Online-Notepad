const { getDB } = require('../config/database');

const Audit = {
    logUserAction: async (userId, action, previousData = null, newData = null) => {
        try {
            const db = getDB();
            await db.execute(
                `INSERT INTO user_audit_log (userId, action, previousData, newData) VALUES (?, ?, ?, ?)`,
                [userId, action, previousData ? JSON.stringify(previousData) : null, newData ? JSON.stringify(newData) : null]
            );
        } catch (error) {
            console.error('Failed to write to User Audit Log:', error);
        }
    },

    logNoteAction: async (userId, noteId, action, previousData = null, newData = null) => {
        try {
            const db = getDB();
            await db.execute(
                `INSERT INTO note_audit_log (userId, noteId, action, previousData, newData) VALUES (?, ?, ?, ?, ?)`,
                [userId, noteId, action, previousData ? JSON.stringify(previousData) : null, newData ? JSON.stringify(newData) : null]
            );
        } catch (error) {
            console.error('Failed to write to Note Audit Log:', error);
        }
    },

    logSharedNoteAction: async (userId, noteId, action, previousData = null, newData = null) => {
        try {
            const db = getDB();
            await db.execute(
                `INSERT INTO shared_note_audit_log (userId, noteId, action, previousData, newData) VALUES (?, ?, ?, ?, ?)`,
                [userId, noteId, action, previousData ? JSON.stringify(previousData) : null, newData ? JSON.stringify(newData) : null]
            );
        } catch (error) {
            console.error('Failed to write to Shared Note Audit Log:', error);
        }
    },

    logTeamAction: async (teamId, performedBy, action, previousData = null, newData = null) => {
        try {
            const db = getDB();
            await db.execute(
                `INSERT INTO team_audit_log (teamId, performedBy, action, previousData, newData)
             VALUES (?, ?, ?, ?, ?)`,
                [
                    teamId,
                    performedBy,
                    action,
                    previousData ? JSON.stringify(previousData) : null,
                    newData ? JSON.stringify(newData) : null,
                ]
            );
        } catch (error) {
            console.error('Failed to write to Team Audit Log:', error);
        }
    },
};

module.exports = Audit;