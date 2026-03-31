const express = require('express');
const teamRouter = express.Router();
const { getDB } = require('../config/database');
const { UserAuth } = require('../middleware/Auth');
const PermissionAuth = require('../middleware/PermissionAuth');
const { sendResponse } = require('../utils/response');
const User = require('../models/user');
const Audit = require('../models/audit');
const { sendInviteEmail } = require('../utils/email');

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
 *     summary: Create a role in a team (owner only)
 *     description: "Creates a new role. Optionally set parentRoleName to define hierarchy. Only the owner can create roles."
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
 *             required: [name, permissions]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Manager
 *               parentRoleName:
 *                 type: string
 *                 example: null
 *                 description: Name of the parent role. Leave empty if this role has no parent.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["note:create", "note:edit", "note:share", "note:view", "role:assign", "role:delete"]
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: Role created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: Manager
 *                     teamId:
 *                       type: integer
 *                       example: 1
 *                     parentRoleId:
 *                       type: integer
 *                       nullable: true
 *                       example: null
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["note:create", "note:edit", "note:share", "note:view", "role:assign", "role:delete"]
 *       400:
 *         description: Role name required, no permissions provided, or invalid permissions
 *       403:
 *         description: Only team owner can create roles
 *       404:
 *         description: Parent role not found
 *       500:
 *         description: Server error
 */

teamRouter.post('/teams/:teamId/roles', UserAuth, PermissionAuth('role:create'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const { name, permissions = [] } = req.body;
        const db = getDB();

        if (!name || name.trim() === '') {
            return sendResponse(res, { status: 400, message: 'Role name is required', data: null });
        }

        if (permissions.length === 0) {
            return sendResponse(res, { status: 400, message: 'At least one permission is required', data: null });
        }

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can create roles', data: null });
        }

        // Validate ALL permissions first before creating anything
        const invalidPermissions = [];
        const validPermissionIds = [];

        for (const action of permissions) {
            const [permRows] = await db.execute(
                `SELECT id FROM permissions WHERE action = ?`, [action]
            );
            if (permRows.length === 0) {
                invalidPermissions.push(action);
            } else {
                validPermissionIds.push({ action, id: permRows[0].id });
            }
        }

        // Reject whole request if any permission is invalid
        if (invalidPermissions.length > 0) {
            return sendResponse(res, {
                status: 400,
                message: `Invalid permissions: ${invalidPermissions.join(', ')}. Role was not created.`,
                data: {
                    invalidPermissions,
                    validPermissions: validPermissionIds.map(p => p.action),
                },
            });
        }

        // All valid — now create the role
        const [result] = await db.execute(
            `INSERT INTO team_roles (teamId, name, createdBy) VALUES (?, ?, ?)`,
            [teamId, name.trim(), req.user.id]
        );

        const roleId = result.insertId;

        for (const perm of validPermissionIds) {
            await db.execute(
                `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
                [roleId, perm.id]
            );
        }

        await Audit.logTeamAction(
            teamId, req.user.id, 'ROLE_CREATED',
            null,
            { roleId, name: name.trim(), permissions }
        );

        const [roleRows] = await db.execute(`SELECT * FROM team_roles WHERE id = ?`, [roleId]);

        return sendResponse(res, {
            status: 201,
            message: 'Role created successfully',
            data: { ...roleRows[0], permissions: validPermissionIds.map(p => p.action) },
        });
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
 * /teams/{teamId}/roles/{roleName}:
 *   delete:
 *     summary: Delete a role by name (owner only)
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
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the role to delete
 *         example: Intern
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Role Intern deleted successfully
 *       403:
 *         description: Only team owner can delete roles
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */

teamRouter.delete('/teams/:teamId/roles/:roleName', UserAuth, async (req, res) => {
    try {
        const { teamId, roleName } = req.params;
        const db = getDB();

        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        if (teamRows.length === 0) {
            return sendResponse(res, { status: 403, message: 'Only team owner can delete roles', data: null });
        }

        const [result] = await db.execute(
            `DELETE FROM team_roles WHERE name = ? AND teamId = ?`, [roleName, teamId]
        );
        if (result.affectedRows === 0) {
            return sendResponse(res, { status: 404, message: `Role '${roleName}' not found`, data: null });
        }

        await Audit.logTeamAction(
            teamId, req.user.id, 'ROLE_DELETED',
            { roleName },
            null
        );

        return sendResponse(res, { status: 200, message: `Role '${roleName}' deleted successfully`, data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles/{roleName}/permissions:
 *   post:
 *     summary: Add permissions to a role by role name
 *     description: "Owner can assign any valid permission. Members with role:assign permission can only assign permissions they have, and only to roles directly under them."
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
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the role to add permissions to
 *         example: Developer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["note:create", "note:edit", "note:view"]
 *     responses:
 *       200:
 *         description: Permissions processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Permissions processed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     targetRole:
 *                       type: string
 *                       example: Developer
 *                     added:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["note:create", "note:edit"]
 *                     alreadyExists:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["note:view"]
 *       400:
 *         description: Invalid permissions provided
 *       403:
 *         description: "Missing role:assign permission or trying to assign permissions you do not have"
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */

teamRouter.post('/teams/:teamId/roles/:roleName/permissions', UserAuth, async (req, res) => {
    try {
        const { teamId, roleName } = req.params;
        const { permissions = [] } = req.body;
        const db = getDB();

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return sendResponse(res, { status: 400, message: 'permissions array is required and cannot be empty', data: null });
        }

        // Find the target role by name
        const [targetRoleRows] = await db.execute(
            `SELECT * FROM team_roles WHERE teamId = ? AND name = ?`, [teamId, roleName]
        );
        if (targetRoleRows.length === 0) {
            return sendResponse(res, { status: 404, message: `Role '${roleName}' not found in this team`, data: null });
        }
        const targetRole = targetRoleRows[0];

        // Check if user is owner
        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        const isOwner = teamRows.length > 0;

        let myPermissions = null;
        let myRoleId = null;

        if (!isOwner) {
            // Check if this member has role:assign permission
            const [memberRows] = await db.execute(
                `SELECT tm.roleId FROM team_members tm
                 JOIN role_permissions rp ON tm.roleId = rp.roleId
                 JOIN permissions p ON rp.permissionId = p.id
                 WHERE tm.teamId = ? AND tm.userId = ? AND tm.status = 'active'
                 AND p.action = 'role:assign'`,
                [teamId, req.user.id]
            );
            if (memberRows.length === 0) {
                return sendResponse(res, { status: 403, message: "You do not have 'role:assign' permission", data: null });
            }

            myRoleId = memberRows[0].roleId;

            // Check target role is a child of this member's role (parentRoleId must point to myRoleId)
            if (targetRole.parentRoleId !== myRoleId) {
                return sendResponse(res, {
                    status: 403,
                    message: `You can only assign permissions to roles that are directly under your role`,
                    data: null,
                });
            }

            // Get this member's own permissions
            const [myPermRows] = await db.execute(
                `SELECT p.action FROM team_members tm
                 JOIN role_permissions rp ON tm.roleId = rp.roleId
                 JOIN permissions p ON rp.permissionId = p.id
                 WHERE tm.teamId = ? AND tm.userId = ? AND tm.status = 'active'`,
                [teamId, req.user.id]
            );
            myPermissions = myPermRows.map(r => r.action);
        }

        // Validate all permissions
        const invalidPermissions = [];
        const unauthorizedPermissions = [];
        const validPermissionIds = [];

        for (const action of permissions) {
            const [permRows] = await db.execute(
                `SELECT id FROM permissions WHERE action = ?`, [action]
            );
            if (permRows.length === 0) {
                invalidPermissions.push(action);
            } else if (myPermissions !== null && !myPermissions.includes(action)) {
                unauthorizedPermissions.push(action);
            } else {
                validPermissionIds.push({ action, id: permRows[0].id });
            }
        }

        if (invalidPermissions.length > 0) {
            return sendResponse(res, {
                status: 400,
                message: `Invalid permissions: ${invalidPermissions.join(', ')}`,
                data: { invalidPermissions },
            });
        }

        if (unauthorizedPermissions.length > 0) {
            return sendResponse(res, {
                status: 403,
                message: `You cannot assign permissions you do not have: ${unauthorizedPermissions.join(', ')}`,
                data: { unauthorizedPermissions },
            });
        }

        // Add permissions
        const added = [];
        const alreadyExists = [];

        for (const perm of validPermissionIds) {
            const [existing] = await db.execute(
                `SELECT id FROM role_permissions WHERE roleId = ? AND permissionId = ?`,
                [targetRole.id, perm.id]
            );
            if (existing.length > 0) {
                alreadyExists.push(perm.action);
            } else {
                await db.execute(
                    `INSERT INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
                    [targetRole.id, perm.id]
                );
                added.push(perm.action);
            }
        }

        await Audit.logTeamAction(
            teamId, req.user.id, 'ROLE_PERMISSION_ADDED',
            null,
            { targetRole: roleName, added, alreadyExists }
        );

        return sendResponse(res, {
            status: 200,
            message: 'Permissions processed successfully',
            data: { targetRole: roleName, added, alreadyExists },
        });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/roles/{roleName}/permissions/{action}:
 *   delete:
 *     summary: Remove a permission from a role by role name and permission action
 *     description: "Owner can remove any permission. Members with role:delete permission can only remove permissions from roles directly under them."
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
 *         name: roleName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the role to remove permission from
 *         example: Developer
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *         description: "The permission action to remove e.g. note:create"
 *         example: "note:create"
 *     responses:
 *       200:
 *         description: Permission removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Permission note:create removed from Developer successfully"
 *       403:
 *         description: "Missing role:delete permission or target role is not under your role"
 *       404:
 *         description: Role or permission not found
 *       500:
 *         description: Server error
 */

teamRouter.delete('/teams/:teamId/roles/:roleName/permissions/:action', UserAuth, async (req, res) => {
    try {
        const { teamId, roleName, action } = req.params;
        const db = getDB();

        // Find role by name
        const [roleRows] = await db.execute(
            `SELECT * FROM team_roles WHERE teamId = ? AND name = ?`, [teamId, roleName]
        );
        if (roleRows.length === 0) {
            return sendResponse(res, { status: 404, message: `Role '${roleName}' not found`, data: null });
        }

        // Check if owner
        const [teamRows] = await db.execute(
            `SELECT * FROM teams WHERE id = ? AND ownerId = ?`, [teamId, req.user.id]
        );
        const isOwner = teamRows.length > 0;

        if (!isOwner) {
            // Must have role:delete permission
            const [memberRows] = await db.execute(
                `SELECT tm.roleId FROM team_members tm
                 JOIN role_permissions rp ON tm.roleId = rp.roleId
                 JOIN permissions p ON rp.permissionId = p.id
                 WHERE tm.teamId = ? AND tm.userId = ? AND tm.status = 'active'
                 AND p.action = 'role:delete'`,
                [teamId, req.user.id]
            );
            if (memberRows.length === 0) {
                return sendResponse(res, { status: 403, message: "You do not have 'role:delete' permission", data: null });
            }

            const myRoleId = memberRows[0].roleId;

            // Target role must be under this member's role
            if (roleRows[0].parentRoleId !== myRoleId) {
                return sendResponse(res, {
                    status: 403,
                    message: 'You can only remove permissions from roles that are directly under your role',
                    data: null,
                });
            }
        }

        // Find permission by action
        const [permRows] = await db.execute(
            `SELECT * FROM permissions WHERE action = ?`, [action]
        );
        if (permRows.length === 0) {
            return sendResponse(res, { status: 404, message: `Permission '${action}' not found`, data: null });
        }

        const [result] = await db.execute(
            `DELETE FROM role_permissions WHERE roleId = ? AND permissionId = ?`,
            [roleRows[0].id, permRows[0].id]
        );
        if (result.affectedRows === 0) {
            return sendResponse(res, { status: 404, message: `Permission '${action}' is not assigned to role '${roleName}'`, data: null });
        }

        await Audit.logTeamAction(
            teamId, req.user.id, 'ROLE_PERMISSION_REMOVED',
            { role: roleName, action },
            null
        );

        return sendResponse(res, { status: 200, message: `Permission '${action}' removed from '${roleName}' successfully`, data: null });
    } catch (err) {
        return sendResponse(res, { status: 500, message: err.message, data: null });
    }
});

/**
 * @swagger
 * /teams/{teamId}/members/invite:
 *   post:
 *     summary: Invite a user to the team by email
 *     description: "Invites a user to the team, assigns them a role, and sends them an invitation email. Owner always has access. Members need the member:invite permission."
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the team
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
 *         description: Member invited and email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: John Doe invited to the team successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     teamId:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 5
 *                         emailId:
 *                           type: string
 *                           example: john@gmail.com
 *                     roleId:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: emailId and roleId are required, already a member, or inviting yourself
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only team owner can invite members
 *       404:
 *         description: User not found or role not found in this team
 *       500:
 *         description: Server error
 */

teamRouter.post('/teams/:teamId/members/invite', UserAuth, PermissionAuth('member:invite'), async (req, res) => {
    try {
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

        try {
            await sendInviteEmail(
                targetUser.emailId,
                `${req.user.firstName} ${req.user.lastName}`,
                teamRows[0].name,
                roleRows[0].name
            );
        } catch (emailErr) {
            console.error('Invite email failed to send:', emailErr);
            // Don't block the invite — member is added even if email fails
        }

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
 *     description: "Owner always has access. Members need the member:remove permission."
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
teamRouter.delete('/teams/:teamId/members/:userId', UserAuth, PermissionAuth('member:remove'), async (req, res) => {
    try {
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
 *       401:
 *         description: Unauthorized
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