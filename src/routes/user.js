const express = require('express');
const userRouter = express.Router();
const bcrypt = require('bcrypt');
const { getDB } = require("../config/database")

const { UserAuth } = require('../middleware/Auth');
const User = require('../models/user')

/**
 * @swagger
 * /user/view:
 *   get:
 *     summary: Get logged-in user profile
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Returns firstName and lastName
 */

userRouter.get("/user/view", UserAuth, async (req, res) =>{
    try {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT firstName, lastName FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).send('User not found');
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).send('Error fetching user profile: ' + err.message);
    }
});

/**
 * @swagger
 * /user/password:
 *   patch:
 *     summary: Update password
 *     tags: [User]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 *       401:
 *         description: Invalid old password
 */

userRouter.patch("/user/password", UserAuth, async (req, res) => {
    try{
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).send('Old password and new password are required');
        }
        // const loggedInUser = req.user;
        const isOldPasswordValid = await User.validatePassword(oldPassword, req.user.password);
        if (!isOldPasswordValid) {
            return res.status(401).send('Invalid Old Password');
        }
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await User.updatePassword(req.user.id, newPasswordHash);

        res.send(`${req.user.firstName} your password is updated successfully!`);
    } catch (err) {
        res.status(500).send('Error while updating user password: ' + err.message);
    }
});

module.exports = userRouter;