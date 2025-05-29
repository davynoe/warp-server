// db.ts
import { MongoClient, Collection } from "npm:mongodb";
import { config } from "../config.ts";
import { District, Line, Schedule, Train, User } from "../definitions.ts";

const client = new MongoClient(config.mongodb.connectionString);
let isConnected = false;

export async function connectToMongoDB() {
  if (isConnected) return;

  try {
    await client.connect();
    isConnected = true;
    console.log("Successfully connected to MongoDB.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

// Export the client and database
export const db = client.db(config.mongodb.dbName);

// Export collections with proper types
export const districts: Collection<District> = db.collection("districts");
export const lines: Collection<Line> = db.collection("lines");
export const trains: Collection<Train> = db.collection("trains");
export const schedules: Collection<Schedule> = db.collection("schedules");
export const users: Collection<User> = db.collection("users");

// Create indexes
async function createIndexes() {
  try {
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ username: 1 }, { unique: true });
    await trains.createIndex({ line: 1 });
    await schedules.createIndex({ lineCode: 1 });
    console.log("Indexes created successfully");
  } catch (error) {
    console.error("Error creating indexes:", error);
  }
}

// Export a function to close the connection
export async function closeConnection() {
  if (isConnected) {
    await client.close();
    isConnected = false;
    console.log("MongoDB connection closed.");
  }
}

// Initialize connection and indexes
await connectToMongoDB();
await createIndexes();
