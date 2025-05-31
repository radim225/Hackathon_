import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface TripData {
  userId: string;
  userDepartment: string;
  userFuelType: string;
  userMarketSegment: string;
  carBrand: string;
  carModel: string;
  carFuelType: string;
  carEfficiency: string;
  distance: string;
  duration: string;
  co2Emissions: string;
  transportType: string;
  cost: string;
  startLocation: string;
  destination: string;
  scheduledDateTime: string;
  tripTimestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const tripData: TripData = await request.json();
    
    // Add timestamp
    tripData.tripTimestamp = new Date().toISOString();
    
    // Define file paths
    const dataDir = path.join(process.cwd(), 'data');
    const lastTripFile = path.join(dataDir, 'last-trip.json');
    const allTripsFile = path.join(dataDir, 'all-trips.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save to last-trip.json (overwrites)
    fs.writeFileSync(lastTripFile, JSON.stringify(tripData, null, 2));
    
    // Append to all-trips.json
    let allTrips: TripData[] = [];
    if (fs.existsSync(allTripsFile)) {
      const fileContent = fs.readFileSync(allTripsFile, 'utf-8');
      try {
        allTrips = JSON.parse(fileContent);
      } catch (error) {
        console.error('Error parsing all-trips.json:', error);
        allTrips = [];
      }
    }
    
    allTrips.push(tripData);
    fs.writeFileSync(allTripsFile, JSON.stringify(allTrips, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trip data saved successfully',
      tripId: tripData.tripTimestamp
    });
    
  } catch (error) {
    console.error('Error saving trip data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save trip data' },
      { status: 500 }
    );
  }
} 