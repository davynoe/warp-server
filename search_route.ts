import {
  DistrictCode,
  Line,
  Route,
  Schedule,
  ScheduleStop,
  Train,
  MergedRoute,
  ScheduleSegment,
} from "./definitions.ts";
const lines: Line[] = JSON.parse(Deno.readTextFileSync("./data/lines.json"));
const schedules: Schedule[] = JSON.parse(
  Deno.readTextFileSync("./data/schedules.json")
);
const trains: Train[] = JSON.parse(Deno.readTextFileSync("./data/trains.json"));

function splitLines(
  stations: DistrictCode[],
  transferStations: DistrictCode[]
): DistrictCode[][] {
  const result: DistrictCode[][] = [];
  let start = 0;

  for (let i = 0; i < stations.length; i++) {
    if (transferStations.includes(stations[i])) {
      const end = i + 1;
      result.push(stations.slice(start, end));
      start = i; // allow overlap
    }
  }

  if (start < stations.length) {
    result.push(stations.slice(start));
  }

  return result;
}

function findNextSchedule(
  lineCode: string,
  startTime: string,
  startStation: DistrictCode,
  endStation: DistrictCode,
  startFromScheduleId?: number
): Schedule | undefined {
  return schedules.find((schedule) => {
    if (schedule.lineCode !== lineCode) return false;
    if (startFromScheduleId && schedule.id < startFromScheduleId) return false;

    const startStop = schedule.stops.find(
      (stop) => stop.station === startStation
    );
    const endStop = schedule.stops.find((stop) => stop.station === endStation);

    if (!startStop || !endStop) return false;

    // Check if this schedule's start time is after or equal to the requested time
    return startStop.arrival >= startTime;
  });
}

export function findRoutes(
  start: DistrictCode,
  end: DistrictCode
): MergedRoute[] {
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
  const queue: { stations: DistrictCode[]; lines: string[] }[] = [
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

      // Find all possible schedules for this route
      let currentScheduleId = 0;
      while (true) {
        let currentTime = "00:00:00";
        const segments = splitLines(current.stations, transferStations);
        const lineSchedules = segments.map((segmentStations, index) => {
          const lineCode = directionalLines[index];
          const schedule = findNextSchedule(
            lineCode,
            currentTime,
            segmentStations[0],
            segmentStations[segmentStations.length - 1],
            index === 0 ? currentScheduleId : undefined
          );

          if (schedule) {
            // Update currentTime for next segment
            const lastStop = schedule.stops.find(
              (stop) =>
                stop.station === segmentStations[segmentStations.length - 1]
            );
            if (lastStop) {
              currentTime = lastStop.arrival;
            }

            // Find the train for this line
            const train = trains.find((t) => t.line === lineCode);

            // Create a schedule segment with only the relevant stops
            const scheduleSegment = {
              id: schedule.id,
              stops: schedule.stops
                .filter((stop) => segmentStations.includes(stop.station))
                .map((stop, index, array) => {
                  // If this is the last stop in the segment, remove departure time
                  if (index === array.length - 1) {
                    return {
                      station: stop.station,
                      arrival: stop.arrival,
                    } as ScheduleStop;
                  }
                  return stop as ScheduleStop;
                }),
            };

            return {
              name: lineCode,
              trainName: train?.name,
              segment: segmentStations,
              schedule: scheduleSegment,
            };
          }

          return {
            name: lineCode,
            trainName: trains.find((t) => t.line === lineCode)?.name,
            segment: segmentStations,
            schedule: undefined,
          };
        });

        // If we couldn't find a valid schedule for any segment, break the loop
        if (lineSchedules.some((ls) => !ls.schedule)) {
          break;
        }

        const route: Route = {
          route: current.stations,
          lines: lineSchedules,
          transfer: transferStations,
          stationsCount: current.stations.length,
          prices: {
            economy: 120,
            firstClass: 400,
          },
        };
        routes.push(route);

        // Get the next schedule ID for the first segment
        const firstSegmentSchedule = lineSchedules[0].schedule;
        if (!firstSegmentSchedule) break;
        currentScheduleId = firstSegmentSchedule.id + 1;
      }

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

  // Merge routes with the same path
  const mergedRoutes = new Map<string, MergedRoute>();

  for (const route of routes) {
    const routeKey = route.route.join(",");
    if (!mergedRoutes.has(routeKey)) {
      // Create the base route structure
      mergedRoutes.set(routeKey, {
        route: route.route,
        lines: route.lines.map((line) => ({
          name: line.name,
          trainName: line.trainName,
          segment: line.segment,
        })),
        transfer: route.transfer,
        stationsCount: route.stationsCount,
        prices: route.prices,
        schedules: [],
      });
    }

    // Add the schedule to the merged route
    const mergedRoute = mergedRoutes.get(routeKey)!;
    const scheduleSegments: ScheduleSegment[] = route.lines
      .filter((line) => line.schedule)
      .map((line) => ({
        line: line.name,
        scheduleId: line.schedule!.id,
        stops: line.schedule!.stops,
      }));

    mergedRoute.schedules.push({
      id: mergedRoute.schedules.length + 1,
      segments: scheduleSegments,
    });
  }

  console.log(
    `Found ${mergedRoutes.size} unique routes with ${routes.length} total schedules`
  );
  return Array.from(mergedRoutes.values());
}
