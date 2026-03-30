const express = require('express');
const teamRouter = express.Router();
const { getDB } = require('../config/database');
const { UserAuth } = require('../middleware/Auth');
const PermissionAuth = require('../middleware/PermissionAuth');
const { sendResponse } = require('../utils/response');
const User = require('../models/user');
const Audit = require('../models/audit');

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Company
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Team name is required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.post('/teams', UserAuth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return sendResponse(res, { status: 400, message: 'Team name is required', data: null });
        }

        const db = getDB();
        const [result] = await db.execute(
            `INSERT INTO teams (name, ownerId) VALUES (?, ?)`,
            [name.trim(), req.user.id]
        );

        const [rows] = await db.execute(`SELECT * FROM teams WHERE id = ?`, [result.insertId]);

        await Audit.logTeamAction(
            result.insertId,
            req.user.id,
            'TEAM_CREATED',
            null,
            { name: name.trim() }
        );

        return sendResponse(res, { status: 201, message: 'Team created successfully', data: rows[0] });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams you own or are a member of
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Teams fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.get('/teams', UserAuth, async (req, res) => {
    try {
        const db = getDB();

        const [ownedTeams] = await db.execute(
            `SELECT *, 'owner' AS role FROM teams WHERE ownerId = ?`,
            [req.user.id]
        );

        const [memberTeams] = await db.execute(
            `SELECT teams.*, team_roles.name AS roleName, 'member' AS role
             FROM team_members
             JOIN teams ON team_members.teamId = teams.id
             JOIN team_roles ON team_members.roleId = team_roles.id
             WHERE team_members.userId = ? AND team_members.status = 'active'`,
            [req.user.id]
        );

        return sendResponse(res, {
            status: 200,
            message: 'Teams fetched successfully',
            data: { ownedTeams, memberTeams },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}:
 *   get:
 *     summary: Get team details
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Team fetched successfully
 *       403:
 *         description: Not a member of this team
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
teamRouter.get('/teams/:teamId', UserAuth, async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();

        const [teamRows] = await db.execute(`SELECT * FROM teams WHERE id = ?`, [teamId]);
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 404, message: 'Team not found', data: null });
        }

        const team = teamRows[0];

        // Must be owner or active member
        if (team.ownerId !== req.user.id) {
            const [memberRows] = await db.execute(
                `SELECT * FROM team_members WHERE teamId = ? AND userId = ? AND status = 'active'`,
                [teamId, req.user.id]
            );
            if (memberRows.length === 0) {
                return sendResponse(res, { status: 403, message: 'You are not a member of this team', data: null });
            }
        }

        return sendResponse(res, { status: 200, message: 'Team fetched successfully', data: team });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles:
 *   post:
 *     summary: Create a role in a team
 *     description: Creates a new role within a team. Requires 'role:create' permission. Currently, this is restricted to the team owner.
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Manager
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [note:create, note:edit, note:view]
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Role name is required
 *       403:
 *         description: Forbidden. Only the team owner can create roles.
 *       500:
 *         description: Server error
 */
teamRouter.post('/teams/:teamId/roles', UserAuth, PermissionAuth('role:create'), async (req, res) => {    try {
        const { teamId } = req.params;
        const { name, permissions = [] } = req.body;
        const db = getDB();

        if (!name || name.trim() === '') {
            return sendResponse(res, { status: 400, message: 'Role name is required', data: null });
        }

        // Only owner can create roles
        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can create roles', data: null });
        }

        const [result] = await db.execute(
            `INSERT INTO team_roles (teamId, name, createdBy) VALUES (?, ?, ?)`,
            [teamId, name.trim(), req.user.id]
        );

        const roleId = result.insertId;

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'ROLE_CREATED',
            null,
            { roleId: roleId, name: name.trim(), permissions }
        );

        // Assign permissions if provided
        if (permissions.length > 0) {
            for (const action of permissions) {
                const [permRows] = await db.execute(
                    `SELECT id FROM permissions WHERE action = ?`, [action]
                );
                if (permRows.length > 0) {
                    await db.execute(
                        `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
                        [roleId, permRows[0].id]
                    );
                }
            }
        }

        const [roleRows] = await db.execute(`SELECT * FROM team_roles WHERE id = ?`, [roleId]);

        return sendResponse(res, { status: 201, message: 'Role created successfully', data: roleRows[0] });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles:
 *   get:
 *     summary: Get all roles in a team
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *       403:
 *         description: Not a member of this team
 *       500:
 *         description: Server error
 */
teamRouter.get('/teams/:teamId/roles', UserAuth, async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();

        // Must be owner or member
        const [teamRows] = await db.execute(`SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]);
        if (teamRows.length === 0) {
            const [memberRows] = await db.execute(
                `SELECT * FROM team_members WHERE teamId = ? AND userId = ? AND status = 'active'`,
                [teamId, req.user.id]
            );
            if (memberRows.length === 0) {
                return sendResponse(res, { status: 403, message: 'You are not a member of this team', data: null });
            }
        }

        const [roles] = await db.execute(
            `SELECT team_roles.*, 
             JSON_ARRAYAGG(permissions.action) AS permissions
             FROM team_roles
             LEFT JOIN role_permissions ON team_roles.id = role_permissions.roleId
             LEFT JOIN permissions ON role_permissions.permissionId = permissions.id
             WHERE team_roles.teamId = ?
             GROUP BY team_roles.id`,
            [teamId]
        );

        return sendResponse(res, { status: 200, message: 'Roles fetched successfully', data: roles });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles/{roleId}:
 *   delete:
 *     summary: Delete a role (owner only)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       403:
 *         description: Only team owner can delete roles
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
teamRouter.delete('/teams/:teamId/roles/:roleId', UserAuth, async (req, res) => {
    try {
        const { teamId, roleId } = req.params;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can delete roles', data: null });
        }

        const [result] = await db.execute(
            `DELETE FROM team_roles WHERE id = ? AND teamId = ?`, [roleId, teamId]
        );
        if (result.affectedRows === 0) {
            return sendResponse(res, { status: 404, message: 'Role not found', data: null });
        }
        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'ROLE_DELETED',
            { roleId },
            null
        );
        return sendResponse(res, { status: 200, message: 'Role deleted successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles/{roleId}/permissions:
 *   post:
 *     summary: Add a permission to a role (owner only)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 example: note:create
 *     responses:
 *       200:
 *         description: Permission added successfully
 *       403:
 *         description: Only team owner can manage permissions
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Server error
 */
teamRouter.post('/teams/:teamId/roles/:roleId/permissions', UserAuth, async (req, res) => {
    try {
        const { teamId, roleId } = req.params;
        const { action } = req.body;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can manage permissions', data: null });
        }

        const [permRows] = await db.execute(`SELECT * FROM permissions WHERE action = ?`, [action]);
        if (permRows.length === 0) {
            return sendResponse(res, { status: 404, message: `Permission '${action}' not found`, data: null });
        }

        await db.execute(
            `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
            [roleId, permRows[0].id]
        );

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'ROLE_PERMISSION_ADDED',
            null,
            { roleId, action }
        );

        return sendResponse(res, { status: 200, message: 'Permission added to role successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles/{roleId}/permissions/{permissionId}:
 *   delete:
 *     summary: Remove a permission from a role (owner only)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Permission removed successfully
 *       403:
 *         description: Only team owner can manage permissions
 *       404:
 *         description: Permission not found on this role
 *       500:
 *         description: Server error
 */
teamRouter.delete('/teams/:teamId/roles/:roleId/permissions/:permissionId', UserAuth, async (req, res) => {
    try {
        const { teamId, roleId, permissionId } = req.params;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can manage permissions', data: null });
        }

        const [result] = await db.execute(
            `DELETE FROM role_permissions WHERE roleId = ? AND permissionId = ?`,
            [roleId, permissionId]
        );
        if (result.affectedRows === 0) {
            return sendResponse(res, { status: 404, message: 'Permission not found on this role', data: null });
        }

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'ROLE_PERMISSION_REMOVED',
            { permissionId },
            null
        );

        return sendResponse(res, { status: 200, message: 'Permission removed from role successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/members/invite:
 *   post:
 *     summary: Invite a user to the team by email
 *     description: Invites a user to the team and assigns them a role. Requires 'member:invite' permission. Currently, this is restricted to the team owner.
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailId, roleId]
 *             properties:
 *               emailId:
 *                 type: string
 *                 example: john@gmail.com
 *               roleId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Member invited successfully
 *       400:
 *         description: Already a member or inviting yourself
 *       403:
 *         description: Forbidden. Only the team owner can invite members.
 *       404:
 *         description: User or role not found
 *       500:
 *         description: Server error
 */
teamRouter.post('/teams/:teamId/members/invite', UserAuth, PermissionAuth('member:invite'), async (req, res) => {    try {
        const { teamId } = req.params;
        const { emailId, roleId } = req.body;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can invite members', data: null });
        }

        if (!emailId || !roleId) {
            return sendResponse(res, { status: 400, message: 'emailId and roleId are required', data: null });
        }

        const targetUser = await User.findByEmail(emailId);
        if (!targetUser) {
            return sendResponse(res, { status: 404, message: 'No user found with this email', data: null });
        }

        if (targetUser.id === req.user.id) {
            return sendResponse(res, { status: 400, message: 'You cannot invite yourself', data: null });
        }

        // Check role belongs to this team
        const [roleRows] = await db.execute(
            `SELECT * FROM team_roles WHERE id = ? AND teamId = ?`, [roleId, teamId]
        );
        if (roleRows.length === 0) {
            return sendResponse(res, { status: 404, message: 'Role not found in this team', data: null });
        }

        // Check already a member
        const [existing] = await db.execute(
            `SELECT * FROM team_members WHERE teamId = ? AND userId = ? AND status != 'removed'`,
            [teamId, targetUser.id]
        );
        if (existing.length > 0) {
            return sendResponse(res, { status: 400, message: 'User is already a member of this team', data: null });
        }

        await db.execute(
            `INSERT INTO team_members (teamId, userId, roleId, invitedBy, status) VALUES (?, ?, ?, ?, 'active')`,
            [teamId, targetUser.id, roleId, req.user.id]
        );

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'MEMBER_INVITED',
            null,
            { invitedUserId: targetUser.id, emailId: targetUser.emailId, roleId }
        );

        return sendResponse(res, {
            status: 201,
            message: `${targetUser.firstName} ${targetUser.lastName} invited to the team successfully`,
            data: { teamId, user: { id: targetUser.id, emailId: targetUser.emailId }, roleId },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/members:
 *   get:
 *     summary: Get all members of a team
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Members fetched successfully
 *       403:
 *         description: Not a member of this team
 *       500:
 *         description: Server error
 */
teamRouter.get('/teams/:teamId/members', UserAuth, async (req, res) => {
    try {
        const { teamId } = req.params;
        const db = getDB();

        // Must be owner or active member
        const [teamRows] = await db.execute(`SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]);
        if (teamRows.length === 0) {
            const [memberRows] = await db.execute(
                `SELECT * FROM team_members WHERE teamId = ? AND userId = ? AND status = 'active'`,
                [teamId, req.user.id]
            );
            if (memberRows.length === 0) {
                return sendResponse(res, { status: 403, message: 'You are not a member of this team', data: null });
            }
        }

        const [members] = await db.execute(
            `SELECT tm.*, u.firstName, u.lastName, u.emailId, tr.name AS roleName
             FROM team_members tm
             JOIN users u ON tm.userId = u.id
             JOIN team_roles tr ON tm.roleId = tr.id
             WHERE tm.teamId = ? AND tm.status != 'removed'`,
            [teamId]
        );

        return sendResponse(res, { status: 200, message: 'Members fetched successfully', data: members });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/members/{userId}/role:
 *   patch:
 *     summary: Change a member's role (owner only)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       403:
 *         description: Only team owner can change roles
 *       404:
 *         description: Member or role not found
 *       500:
 *         description: Server error
 */
teamRouter.patch('/teams/:teamId/members/:userId/role', UserAuth, async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        const { roleId } = req.body;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can change member roles', data: null });
        }

        // Check role belongs to this team
        const [roleRows] = await db.execute(
            `SELECT * FROM team_roles WHERE id = ? AND teamId = ?`, [roleId, teamId]
        );
        if (roleRows.length === 0) {
            return sendResponse(res, { status: 404, message: 'Role not found in this team', data: null });
        }

        // Get previous role for audit
        const [memberRows] = await db.execute(
            `SELECT * FROM team_members WHERE teamId = ? AND userId = ? AND status = 'active'`,
            [teamId, userId]
        );
        if (memberRows.length === 0) {
            return sendResponse(res, { status: 404, message: 'Member not found', data: null });
        }

        await db.execute(
            `UPDATE team_members SET roleId = ? WHERE teamId = ? AND userId = ?`,
            [roleId, teamId, userId]
        );

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'MEMBER_ROLE_CHANGED',
            { roleId: memberRows[0].roleId },
            { roleId }
        );

        return sendResponse(res, { status: 200, message: 'Member role updated successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the team
 *     description: Removes a member from the team. Requires 'member:remove' permission. Currently, this is restricted to the team owner.
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       403:
 *         description: Forbidden. Only the team owner can remove members.
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
teamRouter.delete('/teams/:teamId/members/:userId', UserAuth, PermissionAuth('member:remove'), async (req, res) => {    try {
        const { teamId, userId } = req.params;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can remove members', data: null });
        }

        const [result] = await db.execute(
            `UPDATE team_members SET status = 'removed' WHERE teamId = ? AND userId = ? AND status = 'active'`,
            [teamId, userId]
        );
        if (result.affectedRows === 0) {
            return sendResponse(res, { status: 404, message: 'Member not found', data: null });
        }

        await Audit.logTeamAction(
            teamId,
            req.user.id,
            'MEMBER_REMOVED',
            { removedUserId: userId },
            null
        );

        return sendResponse(res, { status: 200, message: 'Member removed successfully', data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Get all available permissions
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Permissions fetched successfully
 *       500:
 *         description: Server error
 */
teamRouter.get('/permissions', UserAuth, async (req, res) => {
    try {
        const db = getDB();
        const [rows] = await db.execute(`SELECT * FROM permissions`);
        return sendResponse(res, { status: 200, message: 'Permissions fetched successfully', data: rows });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/audit-logs:
 *   get:
 *     summary: Get audit logs for a team (owner only)
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *         description: Max records to return (default 50, max 100)
 *     responses:
 *       200:
 *         description: Team audit logs fetched successfully
 *       403:
 *         description: Only team owner can view audit logs
 *       500:
 *         description: Server error
 */
teamRouter.get('/teams/:teamId/audit-logs', UserAuth, async (req, res) => {
    try {
        const { teamId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can view audit logs', data: null });
        }

        const [logs] = await db.execute(
            `SELECT tal.*, u.firstName, u.lastName, u.emailId
             FROM team_audit_log tal
             LEFT JOIN users u ON tal.performedBy = u.id
             WHERE tal.teamId = ?
             ORDER BY tal.createdAt DESC
             LIMIT ${limit}`,
            [teamId]
        );

        return sendResponse(res, { status: 200, message: 'Team audit logs fetched successfully', data: logs });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

module.exports = teamRouter;