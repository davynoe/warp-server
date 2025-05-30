import { Line, Train } from "./definitions.ts";

// Read the lines data
const lines: Line[] = JSON.parse(await Deno.readTextFile("./data/lines.json"));
const trains: Train[] = [];

const nameTrain = (line_code: string): string => {
  const lineIdentifier = line_code.slice(5, 8);

  // Determine if it's a reverse route and create the final identifier
  const isReverseRoute = line_code.endsWith("-REV");
  const codeName = lineIdentifier + (isReverseRoute ? "-02" : "-01");
  return codeName;
};

for (const line of lines) {
  const line_code = line.code;
  const reverse_code = line_code + "-REV";
  const codeName = nameTrain(line_code);
  const reverseCodeName = nameTrain(reverse_code);

  // Create a train object
  const train: Train = {
    name: codeName,
    line: line_code,
    economySeats: {
      available: 200,
      taken: 0,
    },
    firstClassSeats: {
      available: 100,
      taken: 0,
    },
    status: "stopped",
    currentStation: "none",
  };

  const reverseTrain: Train = {
    name: reverseCodeName,
    line: reverse_code,
    economySeats: {
      available: 200,
      taken: 0,
    },
    firstClassSeats: {
      available: 100,
      taken: 0,
    },
    status: "stopped",
    currentStation: "none",
  };

  trains.push(train);
  trains.push(reverseTrain);
}

// Write the trains to a JSON file
await Deno.writeTextFile("trains.json", JSON.stringify(trains, null, 2));
