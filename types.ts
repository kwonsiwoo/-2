
export interface RouteSegment {
  type: 'walk' | 'bus' | 'subway' | 'taxi';
  instruction: string;
  durationMinutes: number;
  cost: number;
  departureTime?: string; // HH:MM format
  lineName?: string; // e.g., "N26", "Line 2"
}

export interface HybridRoute {
  id: string;
  name: string; // e.g., "Catch the N26 Bus"
  totalCost: number;
  totalDuration: number;
  savedAmount: number;
  segments: RouteSegment[];
  departureTime: string; // ISO string or HH:MM for calculation
  transferPoint: string; // Where to switch to taxi
  taxiCostOnly: number; // The baseline cost
}

export interface Place {
  id: string;
  name: string;
  type: string; // e.g. "Izakaya", "24h Cafe"
  rating: string;
  address: string;
  description: string;
  closingTime: string;
  tags: string[]; // e.g. ["#Cozy", "#Cheap"]
  imageKeyword: string; // e.g. "beer", "ramen", "coffee"
  representativeMenu: string; // e.g. "Assorted Oden Tang"
  distance: string; // e.g. "300m"
  imageUrl?: string; // Optional custom image URL
}

export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
}

export enum AppState {
  HOME = 'HOME',
  SEARCHING = 'SEARCHING',
  RESULTS = 'RESULTS',
  DETAILS = 'DETAILS',
  PLACE_DETAIL = 'PLACE_DETAIL'
}
