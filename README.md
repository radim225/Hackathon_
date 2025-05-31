# Corporate Mobility Platform with Vehicle Report Dashboard

A modern Next.js application for corporate vehicle management with real-time routing and comprehensive analytics dashboard.

## Features

### 🚗 Smart Journey Planning
- **Real-time Google Maps Integration**: Calculate routes for driving, public transport, and walking
- **Multi-transport Options**: Compare car, public transport, and walking with real emissions data
- **User Profile System**: 30+ predefined user profiles with department and vehicle preferences
- **Car Model Selection**: 14+ vehicle models across all fuel types and market segments
- **Live Route Calculation**: Dynamic duration, distance, and cost calculations
- **Eco-friendly Detection**: Highlight sustainable transport options

### 📊 Vehicle Report Dashboard
- **Comprehensive Analytics**: Track mileage, fuel consumption, costs, and emissions
- **Advanced Filtering**: Filter by period (Today, This Month, This Quarter, Year to Date), driver, and car model
- **CO₂ Emission Analysis**: Detailed emission tracking with performance ratings
- **Environmental Impact**: Calculate trees needed to offset carbon footprint
- **Efficiency Insights**: Fuel efficiency ratings, cost per km, and average speed analysis
- **Real-time Data**: Dashboard updates immediately when filters change

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Access the Application**
   - Main App: http://localhost:3000
   - Dashboard: http://localhost:3000/dashboard

## Navigation

### From Main App to Dashboard
- Click the **"Dashboard"** button in the top-right corner of the main interface
- This takes you to the Vehicle Report Dashboard

### From Dashboard to Main App
- Click the **"Home"** button in the top-left corner of the dashboard
- This returns you to the journey planning interface

## Dashboard Usage

### Filter Controls
1. **Period Filter**: 
   - Today: Shows only trips from the current calendar day
   - Week: Shows trips from the last 7 days
   - Month: Shows trips from the current month
   - Year: Shows trips from the current year

2. **Driver Name Filter**: 
   - Select from dropdown of all user IDs in the system
   - Filters trips to show only the selected driver's journeys
   - When a driver is selected, the car model dropdown automatically filters to show only cars that driver has used

3. **Car Model Filter**: 
   - Select from dropdown of vehicle models available for the selected driver
   - If no driver is selected, shows all vehicle models in the trip log
   - Automatically resets when driver selection changes to a driver who hasn't used the previously selected car

### Metrics Displayed

#### Main Metrics Cards
- **Total Mileage**: Sum of all trip distances in kilometers
- **Fuel Consumption**: Average fuel consumption per 100km with efficiency rating
- **Trip Duration**: Total time spent on trips (formatted as hours and minutes)
- **Total Costs**: Sum of all trip costs in CZK

#### CO₂ Emission Analysis
- **Emissions per Kilometer**: Calculated in grams with color-coded rating system:
  - 0-50g: Excellent (Green)
  - 50-100g: Good (Light Green)
  - 100-150g: Moderate (Yellow)
  - 150-200g: High (Orange)
  - 200g+: Very High (Red)
- **Progress Bar**: Visual representation of emission level
- **Emission Tile**: Large display of current emission level with range information

#### Efficiency Insights
- **Fuel Efficiency**: Rating based on L/100km consumption
- **Cost per Km**: Average cost per kilometer traveled
- **Average Speed**: Calculated from distance and duration data

#### Environmental Impact
- **Total CO₂ Emitted**: Sum of all emissions in kilograms
- **Trees to Offset**: Number of trees needed to offset emissions (21kg CO₂ per tree per year)
- **Carbon Footprint Rating**: 
  - Low: <100kg
  - Moderate: 100-500kg
  - High: >500kg

## Data Structure

The dashboard reads from `/public/data/all-trips.json` with the following trip record structure:

```json
{
  "userId": "user1",
  "userDepartment": "Sales",
  "carModel": "Fiesta",
  "distance": "8.56",
  "duration": "21 min",
  "co2Emissions": "1.23kg CO₂",
  "cost": "265 CZK",
  "carEfficiency": "6.0L/100km",
  "tripTimestamp": "2025-05-31T07:00:08.085Z"
}
```

## Technical Features

- **Next.js 14 App Router**: Modern React framework with server-side rendering
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Real-time Calculations**: All metrics update immediately when filters change
- **Responsive Design**: Mobile-first approach that works on all screen sizes
- **Glassmorphism UI**: Modern design with backdrop blur effects and gradients

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Main routing application
│   ├── dashboard/
│   │   └── page.tsx          # Vehicle Report Dashboard
│   └── layout.tsx
├── components/
│   ├── GoogleMapsRouting.tsx # Main routing component
│   └── ui/                   # Reusable UI components
└── lib/                      # Utilities and contexts

public/
└── data/
    ├── all-trips.json        # Trip log data
    ├── users.json           # User profiles
    ├── cars.json            # Vehicle models
    └── emissions.json       # Emission factors
```

## Sample Data

The application includes comprehensive sample data:
- **16 trip records** spanning multiple time periods
- **3 trips for today** (for testing "Today" filter)
- **Multiple car models**: Tesla Model S, Ford Fiesta, MINI Cooper D, etc.
- **Various fuel types**: Petrol, Diesel, Hybrid, PHEV, BEV
- **Different trip distances**: From 8km city trips to 98km intercity journeys

## Troubleshooting

### No Data Showing
- Check that you have trips in the selected time period
- Try changing the filter to "Year to Date" to see all available data
- Ensure the trip data file is accessible at `/public/data/all-trips.json`

### Filters Not Working
- Make sure trip timestamps are in valid ISO format
- Check that car models and user IDs in the data match the filter dropdown options

### Dashboard Not Loading
- Verify the dashboard route is accessible at `/dashboard`
- Check browser console for any JavaScript errors
- Ensure all dependencies are installed with `npm install`

## Contributing

The dashboard is designed to be easily extensible:
- Add new metrics by extending the `metrics` calculation object
- Add new filters by expanding the `FilterState` interface
- Customize the UI by modifying the Tailwind classes
- Add new chart types by integrating charting libraries

This platform provides a complete solution for corporate mobility management with both operational routing capabilities and comprehensive analytics for fleet optimization.