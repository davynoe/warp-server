export interface Line {
  id: number;
  code: string;
  name: string;
  stations: string[];
  length: number;
}

export interface Stop {
  station: string;
  arrival: string;
  departure: string;
}

export interface Schedule {
  lineCode: string;
  stops: Stop[];
}

export interface Train {
  name: string;
  line: string;
  economySeats: number;
  firstClassSeats: number;
  status: "at station" | "in transit" | "stopped";
  currentStation: DistrictCode | "none";
}

export interface District {
  code: DistrictCode;
  name: string;
}

export type DistrictCode =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y";

export interface Route {
  stations: string[];
  lines: string[];
  transferStations: string[];
  totalStations: number;
  priceEconomy: number;
  priceFirstClass: number;
}
