'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Calendar, User, Car, BarChart3, MapPin, Clock, DollarSign, Leaf, TrendingUp, Activity } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import Link from 'next/link';

interface TripRecord {
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

interface FilterState {
  period: 'Today' | 'Week' | 'Month' | 'Year';
  department: string;
  driverName: string;
  carModel: string;
}

const Dashboard: React.FC = () => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    period: 'Today',
    department: '',
    driverName: '',
    carModel: ''
  });

  // Load trip data
  useEffect(() => {
    const loadTripData = async () => {
      try {
        const response = await fetch('/data/all-trips.json');
        const data = await response.json();
        setTrips(data);
      } catch (error) {
        console.error('Failed to load trip data:', error);
      }
    };
    loadTripData();
  }, []);

  // Date filtering functions
  const isInPeriod = (tripDate: Date, period: string): boolean => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'Today':
        const tripToday = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
        return tripToday.getTime() === today.getTime();
      
      case 'Week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return tripDate >= weekAgo && tripDate <= now;
      
      case 'Month':
        return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
      
      case 'Year':
        return tripDate.getFullYear() === now.getFullYear();
      
      default:
        return true;
    }
  };

  // Filter trips based on selected filters
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      const tripDate = new Date(trip.tripTimestamp);
      
      // Date filter
      if (!isInPeriod(tripDate, filters.period)) return false;
      
      // Department filter
      if (filters.department && trip.userDepartment !== filters.department) return false;
      
      // Driver name filter
      if (filters.driverName && trip.userId !== filters.driverName) return false;
      
      // Car model filter
      if (filters.carModel && trip.carModel !== filters.carModel) return false;
      
      return true;
    });
  }, [trips, filters]);

  // Get unique departments for dropdown
  const uniqueDepartments = useMemo(() => {
    const departments = trips.map(trip => trip.userDepartment);
    return Array.from(new Set(departments));
  }, [trips]);

  // Get unique car models for selected driver or all if no driver selected
  const uniqueCarModels = useMemo(() => {
    let relevantTrips = trips;
    
    // If a department is selected, filter by department first
    if (filters.department) {
      relevantTrips = relevantTrips.filter(trip => trip.userDepartment === filters.department);
    }
    
    // If a driver is selected, only show car models that driver has used
    if (filters.driverName) {
      relevantTrips = relevantTrips.filter(trip => trip.userId === filters.driverName);
    }
    
    const models = relevantTrips.map(trip => trip.carModel);
    return Array.from(new Set(models));
  }, [trips, filters.department, filters.driverName]);

  // Get unique user IDs for dropdown suggestions (filtered by department if selected)
  const uniqueUserIds = useMemo(() => {
    let relevantTrips = trips;
    
    // If a department is selected, only show users from that department
    if (filters.department) {
      relevantTrips = trips.filter(trip => trip.userDepartment === filters.department);
    }
    
    const userIds = relevantTrips.map(trip => trip.userId);
    return Array.from(new Set(userIds));
  }, [trips, filters.department]);

  // Reset filters when department changes
  useEffect(() => {
    if (filters.department) {
      const deptTrips = trips.filter(trip => trip.userDepartment === filters.department);
      const deptUserIds = deptTrips.map(trip => trip.userId);
      const deptUniqueUserIds = Array.from(new Set(deptUserIds));
      
      // If the currently selected driver is not in this department, reset it
      if (filters.driverName && !deptUniqueUserIds.includes(filters.driverName)) {
        setFilters(prev => ({...prev, driverName: '', carModel: ''}));
      }
    }
  }, [filters.department, trips]);

  // Reset car model when driver changes
  useEffect(() => {
    if (filters.driverName && filters.carModel) {
      const userTrips = trips.filter(trip => trip.userId === filters.driverName);
      const userCarModels = userTrips.map(trip => trip.carModel);
      const userUniqueCarModels = Array.from(new Set(userCarModels));
      
      // If the currently selected car model is not available for this user, reset it
      if (!userUniqueCarModels.includes(filters.carModel)) {
        setFilters(prev => ({...prev, carModel: ''}));
      }
    }
  }, [filters.driverName, trips]);

  // Parse numerical values from trip data
  const parseDistance = (distance: string): number => parseFloat(distance) || 0;
  const parseDuration = (duration: string): number => {
    // Convert duration string like "21 min" or "1h 2 min" to seconds
    const hourMatch = duration.match(/(\d+)h/);
    const minMatch = duration.match(/(\d+)\s*min/);
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;
    return (hours * 60 + minutes) * 60; // return seconds
  };
  const parseCO2 = (co2: string): number => {
    // Parse "1.23kg CO₂" or "0g CO₂" format
    const match = co2.match(/([\d.]+)/);
    if (match) {
      const value = parseFloat(match[1]);
      return co2.includes('kg') ? value : value / 1000; // convert g to kg if needed
    }
    return 0;
  };
  const parseCost = (cost: string): number => {
    // Parse cost in CZK or USD, convert to CZK
    const match = cost.match(/([\d.]+)/);
    if (match) {
      const value = parseFloat(match[1]);
      // Simple conversion: assume $1 = 23 CZK
      return cost.includes('$') ? value * 23 : value;
    }
    return 0;
  };

  // Fuel consumption lookup (L/100km)
  const getFuelConsumption = (carModel: string, carEfficiency: string): number => {
    // Extract from efficiency string like "6.0L/100km"
    const match = carEfficiency.match(/([\d.]+)L/);
    return match ? parseFloat(match[1]) : 6.5; // default fallback
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    if (filteredTrips.length === 0) {
      return {
        totalDistance: 0,
        totalFuelLiters: 0,
        avgFuelPer100km: 0,
        totalDurationSeconds: 0,
        totalCostCZK: 0,
        totalCO2kg: 0,
        avgCO2PerKm: 0,
        avgSpeed: 0,
        costPerKm: 0,
        treesToOffset: 0,
        carbonFootprintRating: 'No Data',
        fuelEfficiencyRating: 'No Data',
        emissionLevel: 'No Data'
      };
    }

    const totalDistance = filteredTrips.reduce((sum, trip) => sum + parseDistance(trip.distance), 0);
    const totalDurationSeconds = filteredTrips.reduce((sum, trip) => sum + parseDuration(trip.duration), 0);
    const totalCO2kg = filteredTrips.reduce((sum, trip) => sum + parseCO2(trip.co2Emissions), 0);
    const totalCostCZK = filteredTrips.reduce((sum, trip) => sum + parseCost(trip.cost), 0);
    
    // Calculate fuel consumption
    const totalFuelLiters = filteredTrips.reduce((sum, trip) => {
      const distance = parseDistance(trip.distance);
      const fuelPer100km = getFuelConsumption(trip.carModel, trip.carEfficiency);
      return sum + (distance * fuelPer100km / 100);
    }, 0);

    const avgFuelPer100km = totalDistance > 0 ? (totalFuelLiters / totalDistance) * 100 : 0;
    const avgCO2PerKm = totalDistance > 0 ? (totalCO2kg * 1000) / totalDistance : 0; // g/km
    const avgSpeed = totalDurationSeconds > 0 ? (totalDistance / (totalDurationSeconds / 3600)) : 0; // km/h
    const costPerKm = totalDistance > 0 ? totalCostCZK / totalDistance : 0;
    const treesToOffset = Math.ceil(totalCO2kg / 21); // 1 tree = 21 kg CO₂ per year

    // Ratings
    const carbonFootprintRating = totalCO2kg < 100 ? 'Low' : totalCO2kg < 500 ? 'Moderate' : 'High';
    const fuelEfficiencyRating = avgFuelPer100km <= 6 ? 'Good' : avgFuelPer100km <= 8 ? 'Moderate' : 'Poor';
    
    let emissionLevel = 'No Data';
    let emissionColor = 'gray';
    if (avgCO2PerKm <= 50) {
      emissionLevel = 'Excellent';
      emissionColor = 'green';
    } else if (avgCO2PerKm <= 100) {
      emissionLevel = 'Good';
      emissionColor = 'lightgreen';
    } else if (avgCO2PerKm <= 150) {
      emissionLevel = 'Moderate';
      emissionColor = 'yellow';
    } else if (avgCO2PerKm <= 200) {
      emissionLevel = 'High';
      emissionColor = 'orange';
    } else {
      emissionLevel = 'Very High';
      emissionColor = 'red';
    }

    return {
      totalDistance,
      totalFuelLiters,
      avgFuelPer100km,
      totalDurationSeconds,
      totalCostCZK,
      totalCO2kg,
      avgCO2PerKm,
      avgSpeed,
      costPerKm,
      treesToOffset,
      carbonFootprintRating,
      fuelEfficiencyRating,
      emissionLevel,
      emissionColor
    };
  }, [filteredTrips]);

  // Format duration from seconds to "Xh Ym"
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button 
                variant="ghost" 
                className="text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vehicle Report Dashboard</h1>
              <p className="text-gray-600 text-sm font-medium">Track your vehicle performance and expenses</p>
            </div>
          </div>
          <Button 
            className="bg-gray-900 hover:bg-gray-800 text-white border border-gray-300 shadow-sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Filter Controls */}
        <Card className="bg-white border border-gray-200 shadow-sm mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Department Filter */}
              <div>
                <label className="flex items-center space-x-2 text-gray-700 font-medium mb-3">
                  <User className="h-4 w-4" />
                  <span>Department</span>
                </label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({...prev, department: e.target.value}))}
                  className="w-full p-3 bg-white rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 hover:border-gray-400 transition-all duration-200"
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map(department => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div>
                <label className="flex items-center space-x-2 text-gray-700 font-medium mb-3">
                  <Calendar className="h-4 w-4" />
                  <span>Period</span>
                </label>
                <select
                  value={filters.period}
                  onChange={(e) => setFilters(prev => ({...prev, period: e.target.value as FilterState['period']}))}
                  className="w-full p-3 bg-white rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 hover:border-gray-400 transition-all duration-200"
                >
                  <option value="Today">Today</option>
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Year">Year</option>
                </select>
              </div>

              {/* Driver Name Filter */}
              <div>
                <label className="flex items-center space-x-2 text-gray-700 font-medium mb-3">
                  <User className="h-4 w-4" />
                  <span>Driver Name</span>
                </label>
                <select
                  value={filters.driverName}
                  onChange={(e) => setFilters(prev => ({...prev, driverName: e.target.value}))}
                  className="w-full p-3 bg-white rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 hover:border-gray-400 transition-all duration-200"
                >
                  <option value="">All Drivers</option>
                  {uniqueUserIds.map(userId => (
                    <option key={userId} value={userId}>
                      {userId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Car Model Filter */}
              <div>
                <label className="flex items-center space-x-2 text-gray-700 font-medium mb-3">
                  <Car className="h-4 w-4" />
                  <span>Car Model</span>
                </label>
                <select
                  value={filters.carModel}
                  onChange={(e) => setFilters(prev => ({...prev, carModel: e.target.value}))}
                  className="w-full p-3 bg-white rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 hover:border-gray-400 transition-all duration-200"
                >
                  <option value="">All Models</option>
                  {uniqueCarModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredTrips.length === 0 ? (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No data for selected filters</h3>
              <p className="text-gray-600">Try adjusting your filter criteria or check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Main Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Mileage */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Total Mileage</p>
                      <p className="text-xs text-gray-500">Distance traveled</p>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{Math.round(metrics.totalDistance)} km</h3>
                </CardContent>
              </Card>

              {/* Fuel Consumption */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Activity className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Fuel Consumption</p>
                      <p className="text-xs text-gray-500">Average per 100km</p>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {metrics.avgFuelPer100km.toFixed(1)} L
                  </h3>
                  <Badge className={`mt-2 ${
                    metrics.fuelEfficiencyRating === 'Good' ? 'bg-green-100 text-green-800' :
                    metrics.fuelEfficiencyRating === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {metrics.fuelEfficiencyRating}
                  </Badge>
                </CardContent>
              </Card>

              {/* Trip Duration */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Trip Duration</p>
                      <p className="text-xs text-gray-500">Time spent on trips</p>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {formatDuration(metrics.totalDurationSeconds)}
                  </h3>
                </CardContent>
              </Card>

              {/* Total Costs */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Total Costs</p>
                      <p className="text-xs text-gray-500">Including fuel & maintenance</p>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {Math.round(metrics.totalCostCZK)} CZK
                  </h3>
                </CardContent>
              </Card>
            </div>

            {/* CO₂ Emission Analysis */}
            <Card className="bg-white border border-gray-200 shadow-sm mb-8">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Leaf className="h-6 w-6 text-gray-600" />
                  <h2 className="text-xl font-bold text-gray-900">CO₂ Emission Analysis</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Emission Level with Progress Bar */}
                  <div>
                    <div className="text-center mb-6">
                      <h3 className="text-4xl font-bold text-gray-900 mb-2">
                        {Math.round(metrics.avgCO2PerKm)}g
                      </h3>
                      <p className="text-gray-600 text-sm">CO₂ per kilometer</p>
                      <Badge className={`mt-2 ${
                        metrics.emissionLevel === 'Excellent' ? 'bg-green-100 text-green-800' :
                        metrics.emissionLevel === 'Good' ? 'bg-green-100 text-green-700' :
                        metrics.emissionLevel === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                        metrics.emissionLevel === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {metrics.emissionLevel} Emission Level
                      </Badge>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0g (Excellent)</span>
                        <span>200g+ (High)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div 
                          className={`h-4 rounded-full ${
                            metrics.emissionLevel === 'Excellent' ? 'bg-green-500' :
                            metrics.emissionLevel === 'Good' ? 'bg-green-400' :
                            metrics.emissionLevel === 'Moderate' ? 'bg-yellow-500' :
                            metrics.emissionLevel === 'High' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((metrics.avgCO2PerKm / 200) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-center text-xs text-gray-500">
                        Emission Level: {Math.round((metrics.avgCO2PerKm / 200) * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Emission Tile */}
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">
                      {Math.round(metrics.avgCO2PerKm)}g
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">CO₂ Emission</p>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">
                        Range: 0g (Excellent) – 200g+ (High)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Efficiency Insights & Environmental Impact */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Efficiency Insights */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Efficiency Insights</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Fuel Efficiency</span>
                      <Badge className={`${
                        metrics.fuelEfficiencyRating === 'Good' ? 'bg-green-100 text-green-800' :
                        metrics.fuelEfficiencyRating === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {metrics.fuelEfficiencyRating}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Cost per km</span>
                      <span className="text-gray-900 font-bold">
                        {metrics.costPerKm.toFixed(1)} CZK
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Average Speed</span>
                      <span className="text-gray-900 font-bold">
                        {Math.round(metrics.avgSpeed)} km/h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Environmental Impact */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Environmental Impact</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Total CO₂ emitted</span>
                      <span className="text-gray-900 font-bold">
                        {Math.round(metrics.totalCO2kg)} kg
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Trees to offset</span>
                      <span className="text-gray-900 font-bold">
                        {metrics.treesToOffset} trees
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Carbon footprint</span>
                      <Badge className={`${
                        metrics.carbonFootprintRating === 'Low' ? 'bg-green-100 text-green-800' :
                        metrics.carbonFootprintRating === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {metrics.carbonFootprintRating}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 