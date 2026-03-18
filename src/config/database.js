const mongoose = require('mongoose');

const connectDB = async() => {
    mongoose.connect(
    'mongodb+srv://Sahil:Sah%232003@cluster0.nlsznyh.mongodb.net/onlinenotepad'
    );
};

module.exports = { connectDB };