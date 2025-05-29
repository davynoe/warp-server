import { MongoClient, ObjectId } from "npm:mongodb@6.3.0";
import { config } from "./config.ts";
import type {
  User,
  Line,
  Schedule,
  Train,
  Ticket,
  District,
  DistrictCode,
} from "./definitions.ts";

const client = new MongoClient(
  config.mongodb.connectionString || "mongodb://localhost:27017"
);

// Collections
export const users = client
  .db(config.mongodb.dbName || "warp")
  .collection<User>("users");
export const lines = client
  .db(config.mongodb.dbName || "warp")
  .collection<Line>("lines");
export const schedules = client
  .db(config.mongodb.dbName || "warp")
  .collection<Schedule>("schedules");
export const trains = client
  .db(config.mongodb.dbName || "warp")
  .collection<Train>("trains");
export const tickets = client
  .db(config.mongodb.dbName || "warp")
  .collection<Ticket>("tickets");
export const districts = client
  .db(config.mongodb.dbName || "warp")
  .collection<District>("districts");
export const counters = client
  .db(config.mongodb.dbName || "warp")
  .collection<{ _id: string; seq: number }>("counters");

// Create indexes
await users.createIndexes([{ key: { username: 1 }, unique: true }]);
await tickets.createIndexes([{ key: { userId: 1 } }]);
await districts.createIndexes([{ key: { code: 1 }, unique: true }]);

// Initialize counters if they don't exist
const ticketCounter = await counters.findOne({ _id: "ticketId" });
if (!ticketCounter) {
  await counters.insertOne({ _id: "ticketId", seq: 0 });
}

// Initialize districts if they don't exist
const districtsCount = await districts.countDocuments();
if (districtsCount === 0) {
  const districtCodes: DistrictCode[] = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
  ];

  const districtsToInsert = districtCodes.map((code) => ({
    code,
    name: `District ${code}`,
  }));

  await districts.insertMany(districtsToInsert);
}

// Connect to MongoDB
try {
  await client.connect();
  console.log("Connected to MongoDB");
} catch (error) {
  console.error("Failed to connect to MongoDB:", error);
  Deno.exit(1);
}

// Helper function to get next ticket ID
export async function getNextTicketId(): Promise<number> {
  const result = await counters.findOneAndUpdate(
    { _id: "ticketId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after" }
  );
  if (!result) {
    throw new Error("Failed to get next ticket ID");
  }
  return result.seq;
}

// Helper function to convert string ID to ObjectId
export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}

// Helper function to convert ObjectId to string
export function fromObjectId(id: ObjectId): string {
  return id.toString();
}
