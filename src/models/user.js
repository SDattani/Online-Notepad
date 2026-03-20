const { getDB } = require('../config/database');
const bcrypt = require ('bcrypt');
const jwt = require('jsonwebtoken');

// const userSchema = new mongoose.Schema({
//     firstName : {
//         type: String,
//         required: true,
//     },
//     lastName : {
//         type: String,
//     },
//     emailId: {
//         type: String,
//         required: true,
//         unique: true,
//         lowercase: true,
//         trim: true,
//         validate(value){
//             if(!validator.isEmail(value)){
//                 throw new Error('Invalid email');
//             }
//         }
//     },
//     password: {
//         type: String,
//         required: true,
//         validate(value) {
//             if(!validator.isStrongPassword(value)) {
//                 throw new Error('Password must be strong');
//             }
//         }
//     },
// },
// {
//     timestamps : true
// });

// userSchema.methods.jwt = async function (){
//     const user = this;

//     const token = await jwt.sign({ _id: user._id }, process.env.JWT_SECRET ,{
//         expiresIn: '7d'
//     });
//     return token;
// };

// userSchema.methods.validatePassword = async function (password){
//     const user = this;
//     const passwordHash = user.password;

//     const isPasswordValid = await bcrypt.compare(password,passwordHash);
//     return isPasswordValid;
// };

const User = {

    // Find user by email
    findByEmail: async (emailId) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE emailId = ?', [emailId.toLowerCase()]
        );
        return rows[0] || null;
    },

    // Find user by ID
    findById: async (id) => {
        const db = getDB();
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE id = ?', [id]
        );
        return rows[0] || null;
    },

    // Create new user
    create: async ({ firstName, lastName, emailId, password }) => {
        const db = getDB();
        const [result] = await db.execute(
            'INSERT INTO users (firstName, lastName, emailId, password) VALUES (?, ?, ?, ?)',
            [firstName, lastName, emailId.toLowerCase(), password]
        );
        return { id: result.insertId, firstName, lastName, emailId };
    },

    // Update password
    updatePassword: async (id, newPasswordHash) => {
        const db = getDB();
        await db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [newPasswordHash, id]
        );
    },

    // Generate JWT
    generateToken: (user) => {
        return jwt.sign({ _id: user.id }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });
    },

    // Validate password
    validatePassword: async (inputPassword, storedHash) => {
        return await bcrypt.compare(inputPassword, storedHash);
    },
};

module.exports = User;

