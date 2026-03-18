const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require ('bcrypt');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    firstName : {
        type: String,
        required: true,
    },
    lastName : {
        type: String,
    },
    emailId: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error('Invalid email');
            }
        }
    },
    password: {
        type: String,
        required: true,
        validate(value) {
            if(!validator.isStrongPassword(value)) {
                throw new Error('Password must be strong');
            }
        }
    },
},
{
    timestamps : true
});

userSchema.methods.jwt = async function (){
    const user = this;

    const token = await jwt.sign({ _id: user._id }, process.env.JWT_SECRET ,{
        expiresIn: '7d'
    });
    return token;
};

userSchema.methods.validatePassword = async function (password){
    const user = this;
    const passwordHash = user.password;

    const isPasswordValid = await bcrypt.compare(password,passwordHash);
    return isPasswordValid;
};

const User = mongoose.model('User', userSchema);

module.exports = User;