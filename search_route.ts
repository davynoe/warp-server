import { Line, Route } from "./definitions.ts";
const lines: Line[] = JSON.parse(Deno.readTextFileSync("lines.json"));

export function findRoutes(start: string, end: string): Route[] {
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
      const transferStations = current.stations.filter((_station, index) => {
        if (index === 0 || index === current.stations.length - 1) return false;
        const prevLine = current.lines[index - 1];
        const nextLine = current.lines[index];
        return prevLine !== nextLine;
      });

      // Add start and end stations to transferStations for direction checking
      const checkPoints = [
        0,
        ...transferStations.map((station) => current.stations.indexOf(station)),
        current.stations.length - 1,
      ];

      // Determine direction for each line segment
      const directionalLines = distinctLines.map((lineCode) => {
        const line = lines.find((l) => l.code === lineCode)!;
        // Find all segments of this line in the route
        const segments = [];
        for (let i = 0; i < checkPoints.length - 1; i++) {
          const startIdx = checkPoints[i];
          const endIdx = checkPoints[i + 1];
          const segmentStations = current.stations.slice(startIdx, endIdx + 1);
          const segmentLines = current.lines.slice(startIdx, endIdx);

          if (segmentLines.includes(lineCode)) {
            const lineStartIdx = line.stations.indexOf(segmentStations[0]);
            const lineEndIdx = line.stations.indexOf(
              segmentStations[segmentStations.length - 1]
            );
            const isForward = lineEndIdx > lineStartIdx;
            segments.push(isForward ? lineCode : `${lineCode}-REV`);
          }
        }
        return segments[0]; // Take the first segment's direction
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
