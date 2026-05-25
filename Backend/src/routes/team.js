const express = require('express');
const teamRouter = express.Router();
const teamController = require('../controllers/teamController');
const { UserAuth } = require('../middleware/Auth');
const PermissionAuth = require('../middleware/PermissionAuth');

// ==========================================
// 1. TEAM CORE ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/teams:
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
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Team name is required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.post('/api/v1/teams', UserAuth, teamController.createTeam);
teamRouter.get('/api/v1/teams', UserAuth, teamController.getTeams);

/**
 * @swagger
 * /api/v1/teams/{teamId}:
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
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       500:
 *         description: Server error
 */
teamRouter.get('/api/v1/teams/:teamId', UserAuth, teamController.getTeamDetails);

// ==========================================
// 2. ROLE ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/teams/{teamId}/roles:
 *   post:
 *     summary: Create a role
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
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires role:create permission
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all roles in team
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
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.post('/api/v1/teams/:teamId/roles', UserAuth, PermissionAuth('role:create'), teamController.createRole);
teamRouter.get('/api/v1/teams/:teamId/roles', UserAuth, teamController.getTeamRoles);

/**
 * @swagger
 * /api/v1/teams/{teamId}/roles/{roleName}:
 *   delete:
 *     summary: Delete a role by name
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
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.delete('/api/v1/teams/:teamId/roles/:roleName', UserAuth, teamController.deleteRole);

// ==========================================
// 3. PERMISSION ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/teams/{teamId}/roles/{roleName}/permissions:
 *   post:
 *     summary: Add permissions to a role
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["NOTE_CREATE", "NOTE_EDIT"]
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.post('/api/v1/teams/:teamId/roles/:roleName/permissions', UserAuth, teamController.addPermissionsToRole);

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: Get all available permissions
 *     tags: [Teams]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.get('/api/v1/permissions', UserAuth, teamController.getAllPermissions);

// ==========================================
// 4. MEMBER ROUTES
// ==========================================

/**
 * @swagger
 * /api/v1/teams/{teamId}/members/invite:
 *   post:
 *     summary: Invite a user
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
 *               roleId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Invited
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires member:invite permission
 *       500:
 *         description: Server error
 */
teamRouter.post('/api/v1/teams/:teamId/members/invite', UserAuth, PermissionAuth('member:invite'), teamController.inviteMember);

/**
 * @swagger
 * /api/v1/teams/{teamId}/members:
 *   get:
 *     summary: Get all members
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
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.get('/api/v1/teams/:teamId/members', UserAuth, teamController.getTeamMembers);

/**
 * @swagger
 * /api/v1/teams/{teamId}/members/{userId}/role:
 *   patch:
 *     summary: Change member role
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
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.patch('/api/v1/teams/:teamId/members/:userId/role', UserAuth, teamController.changeMemberRole);

/**
 * @swagger
 * /api/v1/teams/{teamId}/members/{userId}:
 *   delete:
 *     summary: Remove member
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
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires member:remove permission
 *       500:
 *         description: Server error
 */
teamRouter.delete('/api/v1/teams/:teamId/members/:userId', UserAuth, PermissionAuth('member:remove'), teamController.removeMember);

// ==========================================
// 5. AUDIT LOGS
// ==========================================

/**
 * @swagger
 * /api/v1/teams/{teamId}/audit-logs:
 *   get:
 *     summary: Get audit logs
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
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
teamRouter.get('/api/v1/teams/:teamId/audit-logs', UserAuth, teamController.getAuditLogs);

module.exports = teamRouter;