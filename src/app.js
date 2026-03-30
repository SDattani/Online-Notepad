require('dotenv').config();
const express = require('express');
const app = express();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require ("./docs/swagger.config.js");
const { connectDB } = require('./config/database');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const noteRouter = require('./routes/note');
const sharedRouter = require('./routes/shared.js')
const teamRouter = require('./routes/team');
const seedPermissions = require('./utils/seedPermissions');

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());
app.use(cookieParser());

app.use('/', authRouter);
app.use('/', userRouter);
app.use('/', noteRouter);
app.use('/', sharedRouter);
app.use('/', teamRouter);

connectDB().then(async () => {
    console.log('Connected to Database successfully!');
    await seedPermissions();
    app.listen(3000, () =>{
        console.log('Server is Running on port 3000');
    });
}).catch((err) => {
    console.log('Error Connecting to Database:', err);
});