import { User } from "./definitions.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Helper function to generate a random ID
function generateId(): string {
  return crypto.randomUUID();
}

// Helper function to hash passwords (in a real app, use a proper password hashing library)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate sample users
async function generateUsers(): Promise<User[]> {
  const users: User[] = [
    {
      id: generateId(),
      username: "john_doe",
      email: "john@example.com",
      password: await hashPassword("password123"),
      bookedSeats: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: "user",
    },
    {
      id: generateId(),
      username: "admin_user",
      email: "admin@example.com",
      password: await hashPassword("admin123"),
      bookedSeats: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: "admin",
    },
    {
      id: generateId(),
      username: "jane_smith",
      email: "jane@example.com",
      password: await hashPassword("password456"),
      bookedSeats: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: "user",
    },
  ];

  return users;
}

// Main function to generate and save users
async function main() {
  try {
    const users = await generateUsers();
    await Deno.writeTextFile(
      "./data/users.json",
      JSON.stringify(users, null, 2)
    );
    console.log("Users generated successfully!");
  } catch (error) {
    console.error("Error generating users:", error);
  }
}

// Run the generator
if (import.meta.main) {
  main();
}
