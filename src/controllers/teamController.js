const { getDB } = require('../config/database');
const User = require('../models/user');
const Audit = require('../models/audit');
const { sendResponse } = require('../utils/response');
const { sendInviteEmail } = require('../utils/email');


// --- TEAM CORE ---
exports.createTeam = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') return sendResponse(res, { status: 400, message: 'Team name is required' });
        const db = getDB();
        const [result] = await db.execute(`INSERT INTO teams (name, ownerId) VALUES (?, ?)`, [name.trim(), req.user.id]);
        const [rows] = await db.execute(`SELECT * FROM teams WHERE id = ?`, [result.insertId]);
        await Audit.logTeamAction(result.insertId, req.user.id, 'TEAM_CREATED', null, { name: name.trim() });
        return sendResponse(res, { status: 201, message: 'Team created successfully', data: rows[0] });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.getTeams = async (req, res) => {
    try {
        const db = getDB();
        const [ownedTeams] = await db.execute(`SELECT *, 'owner' AS role FROM teams WHERE ownerId = ?`, [req.user.id]);
        const [memberTeams] = await db.execute(
            `SELECT teams.*, team_roles.name AS roleName, 'member' AS role FROM team_members 
             JOIN teams ON team_members.teamId = teams.id 
             JOIN team_roles ON team_members.roleId = team_roles.id 
             WHERE team_members.userId = ? AND team_members.status = 'active'`, [req.user.id]
        );
        return sendResponse(res, { status: 200, message: 'Teams fetched', data: { ownedTeams, memberTeams } });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.getTeamDetails = async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();
        const [teamRows] = await db.execute(`SELECT * FROM teams WHERE id = ?`, [teamId]);
        if (teamRows.length === 0) return sendResponse(res, { status: 404, message: 'Team not found' });
        return sendResponse(res, { status: 200, message: 'Team fetched', data: teamRows[0] });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

// --- ROLES & PERMISSIONS ---
exports.createRole = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { name } = req.body;
        const db = getDB();
        const [result] = await db.execute(`INSERT INTO team_roles (teamId, name, createdBy) VALUES (?, ?, ?)`, [teamId, name.trim(), req.user.id]);
        return sendResponse(res, { status: 201, message: 'Role created', data: { id: result.insertId } });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.getTeamRoles = async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();
        const [roles] = await db.execute(
            `SELECT tr.*, JSON_ARRAYAGG(p.action) AS permissions FROM team_roles tr 
             LEFT JOIN role_permissions rp ON tr.id = rp.roleId 
             LEFT JOIN permissions p ON rp.permissionId = p.id 
             WHERE tr.teamId = ? GROUP BY tr.id`, [teamId]
        );
        return sendResponse(res, { status: 200, message: 'Roles fetched', data: roles });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.deleteRole = async (req, res) => {
    try {
        const { teamId, roleName } = req.params;
        const db = getDB();
        await db.execute(`DELETE FROM team_roles WHERE name = ? AND teamId = ?`, [roleName, teamId]);
        return sendResponse(res, { status: 200, message: 'Role deleted' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.addPermissionsToRole = async (req, res) => {
    try {
        const { teamId, roleName } = req.params;
        const { permissions = [] } = req.body;
        const db = getDB();
        const [role] = await db.execute(`SELECT id FROM team_roles WHERE teamId = ? AND name = ?`, [teamId, roleName]);
        for (const action of permissions) {
            const [p] = await db.execute(`SELECT id FROM permissions WHERE action = ?`, [action]);
            if (p.length > 0) await db.execute(`INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`, [role[0].id, p[0].id]);
        }
        return sendResponse(res, { status: 200, message: 'Permissions added' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.removePermission = async (req, res) => {
    try {
        const { teamId, roleName, action } = req.params;
        const db = getDB();
        await db.execute(`DELETE rp FROM role_permissions rp JOIN team_roles tr ON rp.roleId = tr.id JOIN permissions p ON rp.permissionId = p.id WHERE tr.name = ? AND tr.teamId = ? AND p.action = ?`, [roleName, teamId, action]);
        return sendResponse(res, { status: 200, message: 'Permission removed' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.getAllPermissions = async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.execute(`SELECT * FROM permissions`);
        return sendResponse(res, { status: 200, message: 'Permissions fetched', data: rows });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

// --- MEMBERS ---
exports.inviteMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { emailId, roleId } = req.body;
        const target = await User.findByEmail(emailId);
        const db = getDB();
        await db.execute(`INSERT INTO team_members (teamId, userId, roleId, invitedBy, status) VALUES (?, ?, ?, ?, 'active')`, [teamId, target.id, roleId, req.user.id]);
        return sendResponse(res, { status: 201, message: 'Member invited' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.getTeamMembers = async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();
        const [members] = await db.execute(`SELECT tm.*, u.firstName, u.lastName, u.emailId, tr.name AS roleName FROM team_members tm JOIN users u ON tm.userId = u.id JOIN team_roles tr ON tm.roleId = tr.id WHERE tm.teamId = ? AND tm.status != 'removed'`, [teamId]);
        return sendResponse(res, { status: 200, message: 'Members fetched', data: members });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.changeMemberRole = async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        const { roleId } = req.body;
        const db = getDB();
        await db.execute(`UPDATE team_members SET roleId = ? WHERE teamId = ? AND userId = ?`, [roleId, teamId, userId]);
        return sendResponse(res, { status: 200, message: 'Role updated' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

exports.removeMember = async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        const db = getDB();
        await db.execute(`UPDATE team_members SET status = 'removed' WHERE teamId = ? AND userId = ?`, [teamId, userId]);
        return sendResponse(res, { status: 200, message: 'Member removed' });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

// --- AUDIT ---
exports.getAuditLogs = async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();
        const [logs] = await db.execute(`SELECT * FROM team_audit_log WHERE teamId = ? ORDER BY createdAt DESC LIMIT 50`, [teamId]);
        return sendResponse(res, { status: 200, message: 'Logs fetched', data: logs });
    } catch (err) { return sendResponse(res, { status: 500, message: err.message }); }
};

