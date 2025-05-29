export interface Line {
  id: number;
  code: string;
  name: string;
  stations: DistrictCode[];
  length: number;
}

export interface Stop {
  station: DistrictCode;
  arrival: string;
  departure: string;
}

export interface ScheduleStop {
  station: DistrictCode;
  arrival: string;
  departure?: string;
}

export interface Schedule {
  id: number;
  lineCode: string;
  stops: ScheduleStop[];
}

export interface Train {
  name: string;
  line: string;
  economySeats: {
    available: number;
    taken: number;
  };
  firstClassSeats: {
    available: number;
    taken: number;
  };
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
  route: DistrictCode[];
  lines: {
    name: string;
    trainName?: string;
    segment: DistrictCode[];
    schedule?: {
      id: number;
      stops: ScheduleStop[];
    };
  }[];
  transfer: DistrictCode[];
  stationsCount: number;
  prices: {
    economy: number;
    firstClass: number;
  };
}

export interface ScheduleSegment {
  line: string;
  scheduleId: number;
  stops: ScheduleStop[];
}

export interface RouteSchedule {
  id: number;
  segments: ScheduleSegment[];
}

export interface MergedRoute {
  route: DistrictCode[];
  lines: {
    name: string;
    trainName?: string;
    segment: DistrictCode[];
  }[];
  transfer: DistrictCode[];
  stationsCount: number;
  prices: {
    economy: number;
    firstClass: number;
  };
  schedules: RouteSchedule[];
}

export interface BookedSeat {
  trainName: string;
  seatNumber: string;
  class: "economy" | "firstClass";
  journeyDate: string;
  from: DistrictCode;
  to: DistrictCode;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string; // This will be hashed in practice
  bookedSeats: BookedSeat[];
  createdAt: string;
  lastLogin: string;
  role: "user" | "admin";
}

export interface TicketSegment {
  line: string;
  scheduleId: number;
  from: DistrictCode;
  to: DistrictCode;
  departureTime: string;
  arrivalTime: string;
  seatNumber?: string;
}

export interface Ticket {
  id: number;
  userId: string;
  scheduleId: number;
  segments: TicketSegment[];
  status: "active" | "cancelled" | "completed";
  class: "economy" | "firstClass";
  price: number;
  createdAt: string;
  journeyDate: string;
  from: DistrictCode;
  to: DistrictCode;
}
