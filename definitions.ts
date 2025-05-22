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
}

export interface Route {
  stations: string[];
  lines: string[];
  transferStations: string[];
  totalStations: number;
  priceEconomy: number;
  priceFirstClass: number;
}
