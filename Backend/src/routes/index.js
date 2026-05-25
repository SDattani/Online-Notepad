const express = require('express');
const route = express.Router();
const authRoute = require('./auth');
const userRoute = require('./user');
const noteRoute = require('./note');
const sharedRoute = require('./shared');
const teamRoute = require('./team');

route.use('/', authRoute);
route.use('/', userRoute);
route.use('/', noteRoute);
route.use('/', sharedRoute);
route.use('/', teamRoute);

module.exports = route;