import { DistrictCode } from "./definitions.ts";
import { findRoutes } from "./search_route.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import {
  users,
  lines,
  trains,
  schedules,
  tickets,
  districts,
  getNextTicketId,
} from "./mongodb.ts";
import { verifyToken, generateToken } from "./auth.ts";
import type { User, Train, Ticket, TicketSegment } from "./definitions.ts";

const pathname = (url: string) => new URL(url).pathname;

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper function to get users from MongoDB
async function getUsers(): Promise<User[]> {
  const usersList = await users.find({}).toArray();
  return usersList.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.password,
    bookedSeats: user.bookedSeats || [],
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    role: user.role,
  }));
}

Deno.serve({ port: 8000 }, async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const endpoint = pathname(req.url);
  if (endpoint.endsWith("/")) endpoint.slice(0, -1); // Remove trailing slash if present

  // Add CORS headers to all responses
  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  // Authentication endpoints
  if (req.method === "POST" && endpoint === "/register") {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    const existingUsers = await getUsers();
    if (
      existingUsers.some((u) => u.email === email || u.username === username)
    ) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      password: await hashPassword(password),
      bookedSeats: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: "user",
    };

    await users.insertOne(newUser);

    const token = generateToken(newUser);
    return new Response(
      JSON.stringify({ token, user: { ...newUser, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  if (req.method === "POST" && endpoint === "/login") {
    const { username, email, password } = await req.json();

    if (!password || (!username && !email)) {
      return new Response(
        JSON.stringify({ error: "Missing username/email or password" }),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    const existingUsers = await getUsers();
    const user = existingUsers.find(
      (u) => u.username === username || u.email === email
    );

    if (!user || user.password !== (await hashPassword(password))) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    await users.updateOne(
      { id: user.id },
      { $set: { lastLogin: user.lastLogin } }
    );

    const token = generateToken(user);
    return new Response(
      JSON.stringify({ token, user: { ...user, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  // Protected route example
  if (req.method === "GET" && endpoint === "/me") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const existingUsers = await getUsers();
    const user = existingUsers.find((u) => u.id === payload.id);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: responseHeaders,
      });
    }

    return new Response(
      JSON.stringify({ user: { ...user, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  if (req.method === "GET" && endpoint === "/find-routes") {
    console.log("Received request to find routes");
    const url = new URL(req.url);
    const start = url.searchParams.get("start") as DistrictCode;
    const end = url.searchParams.get("end") as DistrictCode;

    if (start && end) {
      const routes = await findRoutes(start, end);
      console.log(JSON.stringify(routes, null, 2));
      return new Response(JSON.stringify(routes, null, 2), {
        headers: responseHeaders,
      });
    } else {
      return new Response("Missing start or end parameters", {
        status: 400,
        headers: responseHeaders,
      });
    }
  } else if (req.method === "GET" && endpoint.startsWith("/schedules")) {
    let lineCode = pathname(req.url).split("/")[2];
    if (!lineCode) {
      const allSchedules = await schedules.find({}).toArray();
      return new Response(JSON.stringify(allSchedules, null, 2), {
        headers: responseHeaders,
      });
    }
    lineCode = lineCode.toUpperCase();

    const schedulesOfLine = await schedules.find({ lineCode }).toArray();
    return new Response(JSON.stringify(schedulesOfLine, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/trains")) {
    const url = new URL(req.url);
    const lineCode = url.searchParams.get("line");
    const status = url.searchParams.get("status");

    if (lineCode) {
      const trainOfLine = await trains.findOne({
        line: lineCode.toUpperCase(),
      });
      return new Response(JSON.stringify(trainOfLine, null, 2), {
        headers: responseHeaders,
      });
    }

    if (status) {
      const trainsWithStatus = await trains
        .find({ status: status as Train["status"] })
        .toArray();
      return new Response(JSON.stringify(trainsWithStatus, null, 2), {
        headers: responseHeaders,
      });
    }

    let codename = pathname(req.url).split("/")[2];

    if (!codename) {
      const allTrains = await trains.find({}).toArray();
      return new Response(JSON.stringify(allTrains, null, 2), {
        headers: responseHeaders,
      });
    }

    codename = codename.toUpperCase();
    const train = await trains.findOne({ name: codename });

    return new Response(JSON.stringify(train, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/lines")) {
    let code = pathname(req.url).split("/")[2];
    if (!code) {
      const allLines = await lines.find({}).toArray();
      return new Response(JSON.stringify(allLines, null, 2), {
        headers: responseHeaders,
      });
    }
    code = code.toUpperCase();

    const line = await lines.findOne({ code });
    return new Response(JSON.stringify(line, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/districts")) {
    let code = pathname(req.url).split("/")[2];
    if (!code) {
      const allDistricts = await districts.find({}).toArray();
      return new Response(JSON.stringify(allDistricts, null, 2), {
        headers: responseHeaders,
      });
    }
    code = code.toUpperCase();

    // Validate if the code is a valid DistrictCode
    const validCodes: DistrictCode[] = [
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

    if (!validCodes.includes(code as DistrictCode)) {
      return new Response(JSON.stringify({ error: "Invalid district code" }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    const district = await districts.findOne({ code: code as DistrictCode });
    if (!district) {
      return new Response(JSON.stringify({ error: "District not found" }), {
        status: 404,
        headers: responseHeaders,
      });
    }
    return new Response(JSON.stringify(district, null, 2), {
      headers: responseHeaders,
    });
  }

  // User management endpoints
  if (req.method === "GET" && endpoint === "/users") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const users = await getUsers();
    return new Response(
      JSON.stringify(users.map((user) => ({ ...user, password: undefined }))),
      {
        headers: responseHeaders,
      }
    );
  }

  // Get current user's profile
  if (req.method === "GET" && endpoint === "/users/me") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const user = await users.findOne({ id: payload.id });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: responseHeaders,
      });
    }

    const typedUser: User = {
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password,
      bookedSeats: user.bookedSeats || [],
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      role: user.role,
    };

    return new Response(
      JSON.stringify({ user: { ...typedUser, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  // Update current user's profile
  if (req.method === "PATCH" && endpoint === "/users/me") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const { username, email, currentPassword, newPassword } = await req.json();
    const user = await users.findOne({ id: payload.id });

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: responseHeaders,
      });
    }

    // Verify current password if changing password
    if (newPassword) {
      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: "Current password is required" }),
          {
            status: 400,
            headers: responseHeaders,
          }
        );
      }

      if (user.password !== (await hashPassword(currentPassword))) {
        return new Response(
          JSON.stringify({ error: "Invalid current password" }),
          {
            status: 401,
            headers: responseHeaders,
          }
        );
      }
    }

    // Check if new username or email is already taken
    if (username && username !== user.username) {
      const existingUser = await users.findOne({ username });
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "Username already taken" }),
          {
            status: 400,
            headers: responseHeaders,
          }
        );
      }
    }

    if (email && email !== user.email) {
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        return new Response(JSON.stringify({ error: "Email already taken" }), {
          status: 400,
          headers: responseHeaders,
        });
      }
    }

    // Update user
    const updateData: Partial<User> = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (newPassword) updateData.password = await hashPassword(newPassword);

    await users.updateOne({ id: user.id }, { $set: updateData });

    const updatedUser = await users.findOne({ id: user.id });
    if (!updatedUser) {
      return new Response(JSON.stringify({ error: "Failed to update user" }), {
        status: 500,
        headers: responseHeaders,
      });
    }

    return new Response(
      JSON.stringify({ user: { ...updatedUser, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  // Delete current user's account
  if (req.method === "DELETE" && endpoint === "/users/me") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const { password } = await req.json();
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required for account deletion" }),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    const user = await users.findOne({ id: payload.id });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: responseHeaders,
      });
    }

    if (user.password !== (await hashPassword(password))) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    await users.deleteOne({ id: user.id });

    return new Response(
      JSON.stringify({ message: "Account deleted successfully" }),
      {
        headers: responseHeaders,
      }
    );
  }

  // Ticket booking endpoint
  if (req.method === "POST" && endpoint === "/tickets") {
    try {
      const token = req.headers.get("Authorization")?.split(" ")[1];
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await users.findOne({ username: payload.username });
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { start, end, scheduleId, class: ticketClass } = await req.json();
      if (!start || !end || !scheduleId || !ticketClass) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Find routes to get schedule details
      const routes = await findRoutes(start, end);
      if (!routes || routes.length === 0) {
        return new Response(JSON.stringify({ error: "No routes found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Find the selected schedule
      const selectedRoute = routes[0]; // Using first route for now
      const selectedSchedule = selectedRoute.schedules.find(
        (s) => s.id === scheduleId
      );
      if (!selectedSchedule) {
        return new Response(JSON.stringify({ error: "Schedule not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create ticket segments
      const segments: TicketSegment[] = selectedSchedule.segments.map(
        (segment) => ({
          line: segment.line,
          scheduleId: segment.scheduleId,
          from: segment.stops[0].station,
          to: segment.stops[segment.stops.length - 1].station,
          departureTime: segment.stops[0].departure || segment.stops[0].arrival,
          arrivalTime: segment.stops[segment.stops.length - 1].arrival,
        })
      );

      // Calculate price based on class
      const price =
        selectedRoute.prices[ticketClass as "economy" | "firstClass"];

      // Get next ticket ID
      const ticketId = await getNextTicketId();

      // Create ticket
      const ticket: Ticket = {
        id: ticketId,
        userId: user.id,
        scheduleId,
        segments,
        status: "active",
        class: ticketClass,
        price,
        createdAt: new Date().toISOString(),
        journeyDate: new Date().toISOString(), // You might want to make this configurable
        from: start,
        to: end,
      };

      // Save ticket to database
      await tickets.insertOne(ticket);

      // Add ticket to user's tickets
      await users.updateOne({ id: user.id }, { $push: { tickets: ticket.id } });

      // Return ticket with username
      const ticketWithUsername = {
        ...ticket,
        username: user.username,
      };

      return new Response(JSON.stringify(ticketWithUsername), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create ticket" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Get user tickets endpoint
  if (req.method === "GET" && endpoint === "/tickets") {
    try {
      const token = req.headers.get("Authorization")?.split(" ")[1];
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await users.findOne({ username: payload.username });
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get all tickets for the user
      const userTickets = await tickets.find({ userId: user.id }).toArray();

      // Add username to each ticket
      const ticketsWithUsername = userTickets.map((ticket) => ({
        ...ticket,
        username: user.username,
      }));

      return new Response(JSON.stringify(ticketsWithUsername), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting tickets:", error);
      return new Response(JSON.stringify({ error: "Failed to get tickets" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not Found", {
    status: 404,
    headers: responseHeaders,
  });
});
