const validator = require('validator');
// const User = require('../models/user');

const validateSignupData = (req) => {
    const { firstName, lastName, emailId, password } = req.body;
    if (!firstName || !lastName){
        throw new Error("First name and Last name are required");
    }else if (!validator.isEmail(emailId)) {
        throw new Error('Invalid email');
    }else if (!validator.isStrongPassword(password)){
        throw new Error('Password should be strong');
    }
};

module.exports = { validateSignupData };