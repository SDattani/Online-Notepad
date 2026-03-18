const express = require('express');
const app = express();
const { connectDB } = require('./config/database');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const noteRouter = require('./routes/note');

app.use(express.json());
app.use(cookieParser());

app.use('/', authRouter);
app.use('/', userRouter);
app.use('/', noteRouter);

connectDB().then(async () => {
    console.log('Connected to MongoDB successfully!');
    app.listen(3000, () =>{
        console.log('Server is Running on port 3000');
    });
}).catch((err) => {
    console.log('Error Connecting to MongoDB:', err);
});