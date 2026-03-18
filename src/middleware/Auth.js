const jwt = require('jsonwebtoken');
const User = require('../models/user');

const UserAuth = async (req, res, next) => {
    try{
        const { token } = req.cookies;
        if (!token) {
            return res.status(401).send('Unauthorized');
        }
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).send('Unauthorized'); // token invalid or expired
        }
        const { _id } = decoded;

        const user = await User.findById(_id);
        if(!user) {
            return res.status(404).send('User Not Found');
        };
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).send('Something went wrong');
    }
};


module.exports = { UserAuth };