const { getDB } = require('../config/database');
const { sendResponse } = require('../utils/response');

const PermissionAuth = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const teamId = parseInt(req.params.teamId);
            const userId = req.user.id;

            if (!teamId) {
                return sendResponse(res, { status: 400, message: 'teamId is required in URL', data: null });
            }

            const db = getDB();

            const [teamRows] = await db.execute(
                `SELECT * FROM teams WHERE id = ? AND ownerId = ?`,
                [teamId, userId]
            );

            if (teamRows.length > 0) {
                req.teamId = teamId;
                req.isTeamOwner = true;
                return next(); // owner always passes
            }

            // Check if active member has the required permission
            const [rows] = await db.execute(
                `SELECT rp.* FROM team_members tm
                 JOIN role_permissions rp ON tm.roleId = rp.roleId
                 JOIN permissions p ON rp.permissionId = p.id
                 WHERE tm.teamId = ?
                 AND tm.userId = ?
                 AND tm.status = 'active'
                 AND p.action = ?`,
                [teamId, userId, requiredPermission]
            );

            if (rows.length === 0) {
                return sendResponse(res, {
                    status: 403,
                    message: `You do not have permission: ${requiredPermission}`,
                    data: null,
                });
            }

            req.teamId = teamId;
            req.isTeamOwner = false;
            next();
        } catch (err) {
            return sendResponse(res, { status: 500, message: err.message, data: null });
        }
    };
};

module.exports = PermissionAuth;