const swaggerJSDoc = require ("swagger-jsdoc");
const path = require("path");

const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "Online Notepad API",
        version: "1.0.0",
        description: "API documentation for Online Notepad with JWT cookie auth, 2FA, and note sharing",
    },
    servers: [
        {
            url: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
            description: "Development server",
        }
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "token",
            }
        }
    }
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../routes/*.js')], // Path to your route files
};

module.exports = swaggerJSDoc(options);
