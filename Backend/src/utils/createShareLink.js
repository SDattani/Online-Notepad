const createShareLink = (token)=>  `${process.env.FRONTEND_URL}/notes/${token}`;

module.exports = createShareLink ;