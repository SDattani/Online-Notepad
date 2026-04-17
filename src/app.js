require('dotenv').config();
const express = require('express');
const app = express();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require ("./docs/swagger.config.js");
const { connectDB } = require('./config/database');
const cookieParser = require('cookie-parser');
const seedPermissions = require('./utils/seedPermissions');
const routes = require('./routes/index.js');

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());
app.use(cookieParser());

app.use('/', routes);
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        message: "This API route does not exist. Check your URL or Method (GET/POST/PATCH/DELETE).",
        data: null
    });
});
// app.use("*", (err, req, res) => {
//     console.error("Unhandled error:", err);
//     res.status(500).json({
//         status: 500,
//         message: "An internal server error occurred.",
//         data: null
//     });
// });

// console.table();

connectDB().then(async () => {
    console.log('Connected to Database successfully!');
    await seedPermissions();
    app.listen(3000, () =>{
        console.log('Server is Running on port 3000');
    });
}).catch((err) => {
    console.log('Error Connecting to Database:', err);
});