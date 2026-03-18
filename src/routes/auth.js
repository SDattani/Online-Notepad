const express = require('express');
const authRouter = express.Router();

const { validateSignupData } = require('../utils/validation');
const User = require("../models/user");
const bcrypt = require('bcrypt');
const validator = require('validator');

authRouter.post('/signup', async (req,res) => {
    try{
        validateSignupData(req);

        const { firstName , lastName , emailId, password } = req.body;

        const passwordHash = await bcrypt.hash(password,10);

        const newUser = new User({
            firstName,
            lastName,
            emailId,
            password : passwordHash,
        });

        await newUser.save();
        res.send('User Signed up Successfully');
    }
    catch (err) {
        res.status(400).send('Error signing up user :'+ err.message);
    };
});

authRouter.post('/login', async (req,res) => {
    try{
        const { emailId , password} = req.body;

        if(!emailId || !validator.isEmail(emailId)){
            throw new Error('Enter an EmailId');
        };

        const user = await User.findOne({ emailId });
        if (!user){
            return res.status(404).send('invalid Credential');
        };

        const isPasswordValid = await user.validatePassword(password);

        if (isPasswordValid) {
            const token = await user.jwt();
            res.cookie('token', token, {
                expires: new Date(Date.now() + 604800 * 1000),
            });
            res.send('User Login Successfully !!');
        }
        else{
            res.status(401).send('Invalid Credntial');
        }
    }
    catch(err){
        res.status(500).send('Error in Logging User' + err.message);
    }
});

authRouter.post('/logout', async (req,res) => {
    res
        .cookie('token', null , {expires : new Date(Date.now()) })
        .send('User Logged Out Successfully !!');
});

module.exports = authRouter;