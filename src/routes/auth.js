const express = require('express');
const authRouter = express.Router();
const bcrypt = require('bcrypt');
const validator = require('validator');
const User = require('../models/user');
const { validateSignupData } = require('../utils/validation');
const { UserAuth } = require('../middleware/Auth');
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, emailId, password]
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Sahil
 *               lastName:
 *                 type: string
 *                 example: Dattani
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *               password:
 *                 type: string
 *                 example: Sah#2003
 *     responses:
 *       200:
 *         description: User signed up successfully
 *       400:
 *         description: Validation error
 */

authRouter.post('/signup', async (req,res) => {
    try {
        validateSignupData(req);
        const { firstName, lastName, emailId, password } = req.body;

        const existingUser = await User.findByEmail(emailId);
        if (existingUser) {
            return res.status(400).send('Email already registered');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await User.create({ firstName, lastName, emailId, password: passwordHash });
        res.send('User Signed up Successfully');
    } catch (err) {
        res.status(400).send('Error signing up user: ' + err.message);
    }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailId, password]
 *             properties:
 *               emailId:
 *                 type: string
 *                 example: sahil@gmail.com
 *               password:
 *                 type: string
 *                 example: Sah#2003
 *     responses:
 *       200:
 *         description: Login successful, sets cookie
 *       401:
 *         description: Invalid credentials
 */

authRouter.post('/login', async (req,res) => {
    try {
        const { emailId, password } = req.body;

        if (!emailId || !validator.isEmail(emailId)) {
            throw new Error('Enter a valid EmailId');
        }

        const user = await User.findByEmail(emailId);
        if (!user) {
            return res.status(404).send('Invalid Credentials');
        }

        const isPasswordValid = await User.validatePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send('Invalid Credentials');
        }

        const token = User.generateToken(user);
        res.cookie('token', token, {
            expires: new Date(Date.now() + 604800 * 1000),
        });
        res.send('User Login Successfully!!');
    } catch (err) {
        res.status(500).send('Error logging in: ' + err.message);
    }
});

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */

authRouter.post('/logout',UserAuth, async (req,res) => {
    res.cookie('token', null, { expires: new Date(Date.now()) })
       .send('User Logged Out Successfully!!');
});


module.exports = authRouter;