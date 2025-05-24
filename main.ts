import {
  District,
  DistrictCode,
  Line,
  Schedule,
  Train,
} from "./definitions.ts";
import { findRoutes } from "./search_route.ts";
const pathname = (url: string) => new URL(url).pathname;

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve({ port: 8000 }, (req) => {
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
