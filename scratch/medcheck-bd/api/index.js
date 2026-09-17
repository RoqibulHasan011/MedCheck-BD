const app = require('../server/server');
const { connectDB } = require('../server/config/db');

let databaseConnection;

module.exports = async (req, res) => {
	if (req.url.startsWith('/api/health')) {
		return app(req, res);
	}

	try {
		databaseConnection ||= connectDB();
		await databaseConnection;
	} catch (error) {
		return res.status(503).json({
			success: false,
			message: error.message,
		});
	}

	return app(req, res);
};