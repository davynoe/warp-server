import type { User } from "./definitions.ts";

// Helper function to verify JWT token
export function verifyToken(
  token: string
): { id: string; username: string; role: "user" | "admin" } | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

// Helper function to generate JWT token (in a real app, use a proper JWT library)
export function generateToken(user: User): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  return btoa(JSON.stringify(payload)); // This is a simple encoding, use proper JWT in production
}
