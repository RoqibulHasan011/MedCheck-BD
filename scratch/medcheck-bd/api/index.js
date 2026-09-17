const app = require('../server/server');
const { connectDB } = require('../server/config/db');

let databaseConnection;

module.exports = async (req, res) => {
	databaseConnection ||= connectDB();
	await databaseConnection;
	return app(req, res);
};