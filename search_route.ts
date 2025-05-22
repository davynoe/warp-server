import { Line, Route } from "./definitions.ts";
const lines: Line[] = JSON.parse(Deno.readTextFileSync("lines.json"));

const start = "K";
const end = "J";

function findRoutes(start: string, end: string): Route[] {
  // Create a map of stations to their connected lines
  const stationMap = new Map<string, string[]>();

  // Build the station map
  for (const line of lines) {
    for (const station of line.stations) {
      if (!stationMap.has(station)) {
        stationMap.set(station, []);
      }
      stationMap.get(station)!.push(line.code);
    }
  }

  // Find all possible routes using BFS
  const routes: Route[] = [];
  const queue: { stations: string[]; lines: string[] }[] = [
    {
      stations: [start],
      lines: [],
    },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentStation = current.stations[current.stations.length - 1];

    if (currentStation === end) {
      // Calculate route details
      const distinctLines = [...new Set(current.lines)];
      const transferStations = current.stations.filter((station, index) => {
        if (index === 0 || index === current.stations.length - 1) return false;
        const prevLine = current.lines[index - 1];
        const nextLine = current.lines[index];
        return prevLine !== nextLine;
      });

      // Check direction for each line and append -REV if needed
      const directionalLines = distinctLines.map((lineCode) => {
        const line = lines.find((l) => l.code === lineCode)!;
        const firstStationIndex = line.stations.indexOf(current.stations[0]);
        const lastStationIndex = line.stations.indexOf(
          current.stations[current.stations.length - 1]
        );

        // If we're traveling in reverse order (higher index to lower index)
        if (firstStationIndex > lastStationIndex) {
          return `${lineCode}-REV`;
        }
        return lineCode;
      });

      const route: Route = {
        stations: current.stations,
        lines: directionalLines,
        transferStations: transferStations,
        totalStations: current.stations.length - 1,
        priceEconomy: 120,
        priceFirstClass: 400,
      };
      routes.push(route);
      continue;
    }

    if (visited.has(currentStation)) continue;
    visited.add(currentStation);

    // Get all lines passing through current station
    const stationLines = stationMap.get(currentStation) || [];

    for (const lineCode of stationLines) {
      const line = lines.find((l) => l.code === lineCode)!;
      const stationIndex = line.stations.indexOf(currentStation);

      // Check stations before and after current station
      const adjacentStations = [
        line.stations[stationIndex - 1],
        line.stations[stationIndex + 1],
      ].filter((s) => s && !current.stations.includes(s));

      for (const nextStation of adjacentStations) {
        queue.push({
          stations: [...current.stations, nextStation],
          lines: [...current.lines, lineCode],
        });
      }
    }
  }

  return routes;
}

// Find and display all possible routes
const routes = findRoutes(start, end);
console.log("Possible routes:", routes);
