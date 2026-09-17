const mongoose = require('mongoose');

let mongod = null;

const connectDB = async () => {
  const isVercel = process.env.VERCEL === '1';
  const uri = process.env.MONGODB_URI || (isVercel ? '' : 'mongodb://127.0.0.1:27017/medcheck_bd');

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required on Vercel');
  }
  
  try {
    // Attempt connection to provided MongoDB URI (e.g. local or Atlas)
    console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500, // Quick failover if local daemon is not running
    });
    console.log(`[Database] Connected successfully to live MongoDB: ${mongoose.connection.host}`);
  } catch (err) {
    console.warn(`[Database] Live MongoDB connection failed (${err.message}).`);
    if (isVercel) {
      throw err;
    }

    console.log('[Database] Starting built-in in-memory MongoDB server for standalone zero-config operation...');
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'medcheck_bd'
        }
      });
      const memoryUri = mongod.getUri();
      console.log(`[Database] In-memory MongoDB server running at: ${memoryUri}`);
      
      await mongoose.connect(memoryUri);
      console.log('[Database] Connected to In-Memory MongoDB database successfully.');
    } catch (memErr) {
      console.error('[Database] Failed to start in-memory MongoDB fallback:', memErr.message);
      throw memErr;
    }
  }
};

const closeDB = async () => {
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = { connectDB, closeDB };
