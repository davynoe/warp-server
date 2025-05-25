import {
  District,
  DistrictCode,
  Line,
  Schedule,
  Train,
  User,
} from "./definitions.ts";
import { findRoutes } from "./search_route.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const pathname = (url: string) => new URL(url).pathname;

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper function to generate JWT token (in a real app, use a proper JWT library)
function generateToken(user: User): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  return btoa(JSON.stringify(payload)); // This is a simple encoding, use proper JWT in production
}

// Helper function to verify JWT token
function verifyToken(
  token: string
): { id: string; username: string; role: string } | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

// Helper function to get users from file
function getUsers(): User[] {
  try {
    return JSON.parse(Deno.readTextFileSync("./data/users.json"));
  } catch {
    return [];
  }
}

// Helper function to save users to file
function saveUsers(users: User[]) {
  Deno.writeTextFileSync("./data/users.json", JSON.stringify(users, null, 2));
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

    const users = getUsers();
    if (users.some((u) => u.email === email || u.username === username)) {
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

    users.push(newUser);
    saveUsers(users);

    const token = generateToken(newUser);
    return new Response(
      JSON.stringify({ token, user: { ...newUser, password: undefined } }),
      {
        headers: responseHeaders,
      }
    );
  }

  if (req.method === "POST" && endpoint === "/login") {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Missing username or password" }),
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    const users = getUsers();
    const user = users.find((u) => u.username === username);

    if (!user || user.password !== (await hashPassword(password))) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    saveUsers(users);

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

    const users = getUsers();
    const user = users.find((u) => u.id === payload.id);
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
      const routes = findRoutes(start, end);
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
    const schedules: Schedule[] = JSON.parse(
      Deno.readTextFileSync("./data/schedules.json")
    );

    let lineCode = pathname(req.url).split("/")[2];
    if (!lineCode) {
      return new Response(JSON.stringify(schedules, null, 2), {
        headers: responseHeaders,
      });
    }
    lineCode = lineCode.toUpperCase();

    const schedulesOfLine = schedules.filter(
      (schedule) => schedule.lineCode === lineCode
    );

    return new Response(JSON.stringify(schedulesOfLine, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/trains")) {
    const trains: Train[] = JSON.parse(
      Deno.readTextFileSync("./data/trains.json")
    );
    const url = new URL(req.url);
    const lineCode = url.searchParams.get("line");
    const status = url.searchParams.get("status");

    if (lineCode) {
      const trainOfLine = trains.find(
        (train) => train.line === lineCode.toUpperCase()
      );
      return new Response(JSON.stringify(trainOfLine, null, 2), {
        headers: responseHeaders,
      });
    }

    if (status) {
      const trainsWithStatus = trains.filter(
        (train) => train.status === status
      );
      return new Response(JSON.stringify(trainsWithStatus, null, 2), {
        headers: responseHeaders,
      });
    }

    let codename = pathname(req.url).split("/")[2];

    if (!codename) {
      return new Response(JSON.stringify(trains, null, 2), {
        headers: responseHeaders,
      });
    }

    codename = codename.toUpperCase();

    const train = trains.find((train) => train.name === codename);

    return new Response(JSON.stringify(train, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/districts")) {
    const districts: District[] = JSON.parse(
      Deno.readTextFileSync("./data/districts.json")
    );

    let code = pathname(req.url).split("/")[2];
    if (!code) {
      return new Response(JSON.stringify(districts, null, 2), {
        headers: responseHeaders,
      });
    }
    code = code.toUpperCase();

    const district = districts.find((district) => district.code === code);

    return new Response(JSON.stringify(district, null, 2), {
      headers: responseHeaders,
    });
  } else if (req.method === "GET" && endpoint.startsWith("/lines")) {
    const lines: Line[] = JSON.parse(
      Deno.readTextFileSync("./data/lines.json")
    );

    let code = pathname(req.url).split("/")[2];
    if (!code) {
      return new Response(JSON.stringify(lines, null, 2), {
        headers: responseHeaders,
      });
    }
    code = code.toUpperCase();

    const line = lines.find((line) => line.code === code);

    return new Response(JSON.stringify(line, null, 2), {
      headers: responseHeaders,
    });
  }

  return new Response("Not Found", {
    status: 404,
    headers: responseHeaders,
  });
});
