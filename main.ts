import { Schedule, Train } from "./definitions.ts";
import { findRoutes } from "./search_route.ts";
const pathname = (url: string) => new URL(url).pathname;

Deno.serve({ port: 8000 }, (req) => {
  const endpoint = pathname(req.url);
  if (endpoint.endsWith("/")) endpoint.slice(0, -1); // Remove trailing slash if present

  if (req.method === "GET" && endpoint === "/find-routes") {
    console.log("Received request to find routes");
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (start && end) {
      const routes = findRoutes(start, end);
      console.log(JSON.stringify(routes, null, 2));
      return new Response(JSON.stringify(routes, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response("Missing start or end parameters", { status: 400 });
    }
  } else if (req.method === "GET" && endpoint.startsWith("/schedules")) {
    const schedules: Schedule[] = JSON.parse(
      Deno.readTextFileSync("./schedules.json")
    );

    let lineCode = pathname(req.url).split("/")[2];
    if (!lineCode) {
      return new Response(JSON.stringify(schedules, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    lineCode = lineCode.toUpperCase();

    const schedulesOfLine = schedules.filter(
      (schedule) => schedule.lineCode === lineCode
    );

    return new Response(JSON.stringify(schedulesOfLine, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } else if (req.method === "GET" && endpoint.startsWith("/trains")) {
    const trains: Train[] = JSON.parse(Deno.readTextFileSync("./trains.json"));
    const url = new URL(req.url);
    const lineCode = url.searchParams.get("line");
    const status = url.searchParams.get("status");

    if (lineCode) {
      const trainOfLine = trains.find(
        (train) => train.line === lineCode.toUpperCase()
      );
      return new Response(JSON.stringify(trainOfLine, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (status) {
      const trainsWithStatus = trains.filter(
        (train) => train.status === status
      );
      return new Response(JSON.stringify(trainsWithStatus, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let codename = pathname(req.url).split("/")[2];

    if (!codename) {
      return new Response(JSON.stringify(trains, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    codename = codename.toUpperCase();

    const train = trains.find((train) => train.name === codename);

    return new Response(JSON.stringify(train, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404 });
});
