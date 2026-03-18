const express = require('express');
const userRouter = express.Router();
const bcrypt = require('bcrypt');

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
        const loggedInUser = req.user;
        const findUser = await User.findOne({
            _id : loggedInUser._id
        }).select("firstName lastName");
        res.send(findUser);
    }
    catch (err) {
        res.status(500).send('Error in fetching User profile ')
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
        const loggedInUser = req.user;
        const isOldPasswordValid = await loggedInUser.validatePassword(oldPassword);
        if (!isOldPasswordValid) {
            return res.status(401).send('Invalid Old Password');
        }
        loggedInUser.password = newPassword;
        loggedInUser.password = await bcrypt.hash(newPassword, 10);
        await loggedInUser.save();
        res.send(`${loggedInUser.firstName} your Password is Updated successfully!`);
    }
    catch(err){
        res.status(500).send('Error while updating user password : '+ err.message);
    }
});

module.exports = userRouter;