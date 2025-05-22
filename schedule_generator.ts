import { Line, Stop, Schedule } from "./definitions.ts";

// Read the lines data
const lines: Line[] = JSON.parse(await Deno.readTextFile("lines.json"));

// Helper: format Date object to "HH:mm:ss"
const formatTime = (date: Date): string => {
  return date.toTimeString().split(" ")[0];
};

// Helper: parse "HH:mm:ss" into a Date object (today's date)
const parseTime = (timeString: string): Date => {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  const now = new Date();
  now.setHours(hours, minutes, seconds, 0);
  return now;
};

const generateSchedule = (
  line_code: string,
  starting_time_str: string,
  reverse = false
): Schedule => {
  const line = lines.find((line) => line.code === line_code);
  if (!line) {
    throw new Error("line not found");
  }

  const stations = line.stations;
  if (reverse) {
    stations.reverse();
    line_code += "-REV";
  }

  const stops: Stop[] = [];
  let currentTime = parseTime(starting_time_str);
  for (let i = 0; i < line.length; i++) {
    const arrival = new Date(currentTime);
    const departure = new Date(currentTime.getTime() + 10 * 60 * 1000); // 10 minutes later

    stops.push({
      station: line.stations[i],
      arrival: formatTime(arrival),
      departure: formatTime(departure),
    });

    // 10 seconds later, from district X to district Y
    currentTime = new Date(currentTime.getTime() + 10 * 1000 + 10 * 60 * 1000);
  }

  return {
    lineCode: line_code,
    stops: stops,
  };
};

const schedules: Schedule[] = [];
const starting_times = [
  "08:00:00",
  "11:00:00",
  "14:00:00",
  "17:00:00",
  "20:00:00",
  "23:00:00",
];

for (const line of lines) {
  for (const starting_time of starting_times) {
    const schedule = generateSchedule(line.code, starting_time, false);
    schedules.push(schedule);
    const reverseSchedule = generateSchedule(line.code, starting_time, true);
    schedules.push(reverseSchedule);
  }
}

// Write the schedules to a JSON file
await Deno.writeTextFile("schedules.json", JSON.stringify(schedules, null, 2));
