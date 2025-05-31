/*
  getCarCost.ts
  ----------------
  Utility functions for calculating trip costs based on car efficiency data and
  the latest Czech fuel-price table provided by the user:

    Benzín (Natural 95)   1 l  = 33.71 Kč
    Nafta  (Diesel)       1 l  = 32.24 Kč
    Elektřina (EV charge) 1 kWh = 15.00 Kč

  Formulae
  --------
  • Liquid fuels (l/100 km):  cost = distance_km × (efficiency_l_per_100km / 100) × price_per_litre
  • Electric (kWh/100 km):    cost = distance_km × (efficiency_kWh_per_100km / 100) × price_per_kWh
*/

export interface Trip {
  carModel: string;          // e.g. "Volkswagen Polo"
  distance: string | number; // km as string or number
}

export interface Car {
  brand: string;
  model: string;
  fuelType: string;          // Petrol | Diesel | Hybrid | Plug-in Hybrid Electric Vehicle | Battery Electric Vehicle
  efficiency: string;        // e.g. "6.2L/100km" or "18kWh/100km"
}

export interface FuelPrices {
  [fuelType: string]: number;
}

// Latest Czech fuel / energy prices (CZK)
export const czFuelPrices: FuelPrices = {
  Petrol: 33.71,                           // Benzín (Natural 95)
  Diesel: 32.24,                           // Nafta
  Hybrid: 33.71,                           // Hybrid ‑ uses petrol engine when burning fuel
  "Plug-in Hybrid Electric Vehicle": 33.71, // PHEV – assumes petrol cost when ICE is used
  "Battery Electric Vehicle": 15.0         // Electricity price per kWh
};

// --- Helper ---------------------------------------------------------------

function parseEfficiencyValue(eff: string): number {
  // Extract the numeric part (supports both "6.2L/100km" and "18kWh/100km")
  const match = eff.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : NaN;
}

function isElectric(fuelType: string): boolean {
  return fuelType === "Battery Electric Vehicle";
}

// -------------------------------------------------------------------------
/**
 * Calculate the cost of a single trip (in CZK).
 * @param trip  Trip data { carModel, distance }
 * @param cars  Parsed car list (from cars.json)
 * @param prices Fuel-price table in CZK (defaults to czFuelPrices)
 */
export function getCarCost(
  trip: Trip,
  cars: Car[],
  prices: FuelPrices = czFuelPrices
): number {
  const distanceKm = typeof trip.distance === "string" ? parseFloat(trip.distance) : trip.distance;
  if (!distanceKm || Number.isNaN(distanceKm)) return 0;

  // Attempt to locate car entry by full "Brand Model" string
  const car = cars.find(c => `${c.brand} ${c.model}`.toLowerCase() === trip.carModel.toLowerCase());
  if (!car) return 0;

  const eff = parseEfficiencyValue(car.efficiency);
  if (!eff) return 0;

  const unitPrice = prices[car.fuelType] ?? 0;
  if (!unitPrice) return 0;

  const tripCost = distanceKm * (eff / 100) * unitPrice;
  return Math.round(tripCost * 100) / 100; // round to 2 decimals
}

/**
 * Aggregate helpers
 */
export function getTotalCost(trips: Trip[], cars: Car[], prices = czFuelPrices): number {
  return trips.reduce((sum, t) => sum + getCarCost(t, cars, prices), 0);
}

export function getCostPerKm(totalCost: number, totalDistanceKm: number): number {
  return totalDistanceKm > 0 ? totalCost / totalDistanceKm : 0;
} 