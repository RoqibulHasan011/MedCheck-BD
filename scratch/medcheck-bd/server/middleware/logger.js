const AccessLog = require('../models/AccessLog');

const logAccess = async ({ req, action, resourceType, resourceId, details }) => {
  try {
    const user = req?.user;
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';

    await AccessLog.create({
      userId: user?._id || null,
      userEmail: user?.email || 'guest@medcheckbd.com',
      userRole: user?.role || 'guest',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : '',
      details: details || '',
      ipAddress,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
};

module.exports = { logAccess };
