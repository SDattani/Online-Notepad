const swaggerJSDoc = require ("swagger-jsdoc");
const path = require("path");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "My API",
    version: "1.0.0",
    description: "API documentation with Swagger",
  },
  servers: [
    { url: "http://localhost:3000", description: "Development server" }
  ],
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../routes/*.js')], // Path to your route files
};

module.exports = swaggerJSDoc(options);