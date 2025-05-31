'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Clock, DollarSign, Leaf, Navigation, Search, Bus, Car, PersonStanding, Zap, ArrowUpDown, Route, Timer, Target, User, Settings, BarChart3, Menu, CarFront, ChevronDown, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { getCarCost, czFuelPrices } from '../utils/getCarCost';
import Link from 'next/link';

interface Location {
  lat: number;
  lng: number;
}

interface TransportOption {
  id: string;
  type: string;
  time: string;
  cost: string;
  emissions: string;
  isEcoFriendly: boolean;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  buttonColor: string;
  travelMode: string;
}

interface RouteInfo {
  distance: string;
  duration: string;
  eta: string;
  selectedTransport: string;
  transitTypes?: string[];
}

interface UserProfile {
  userId: string;
  department: string;
  fuelType: string;
  marketSegment: string;
  carModel: string;
}

interface CarModel {
  id: string;
  brand: string;
  model: string;
  fuelType: string;
  marketSegment: string;
  emissions: string;
  efficiency: string;
  isRecommended?: boolean;
}

const GoogleMapsRouting: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [routeOptions, setRouteOptions] = useState<TransportOption[]>([]);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [calculatedDurations, setCalculatedDurations] = useState<{[key: string]: string}>({});
  const [calculatedCosts, setCalculatedCosts] = useState<{[key: string]: string}>({});
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarModel | null>(null);
  const [showAllCars, setShowAllCars] = useState(false);
  const [showCarSelection, setShowCarSelection] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [selectedTransportOption, setSelectedTransportOption] = useState<TransportOption | null>(null);
  const [carsDatabase, setCarsDatabase] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCarModal, setShowCarModal] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Real emissions data from emissions.json (Scope 1 - direct vehicle emissions)
  const emissionFactors = {
    "Small car": {
      "Diesel": 0.13994,
      "Petrol": 0.1437,
      "Hybrid": 0.11274,
      "Plug-in Hybrid Electric Vehicle": 0.03012,
      "Battery Electric Vehicle": 0.0
    },
    "Medium car": {
      "Diesel": 0.16807,
      "Petrol": 0.17726,
      "Hybrid": 0.1149,
      "Plug-in Hybrid Electric Vehicle": 0.0812,
      "Battery Electric Vehicle": 0.0
    },
    "Large car": {
      "Diesel": 0.20729,
      "Petrol": 0.26885,
      "Hybrid": 0.15486,
      "Plug-in Hybrid Electric Vehicle": 0.10306,
      "Battery Electric Vehicle": 0.0
    },
    "Average car": {
      "Diesel": 0.16984,
      "Petrol": 0.1645,
      "Hybrid": 0.12607,
      "Plug-in Hybrid Electric Vehicle": 0.0936,
      "Battery Electric Vehicle": 0.0
    }
  };

  // Map instances
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  // Calculate real emissions
  const calculateRealEmissions = (fuelType: string, marketSegment: string, distanceKm: number): string => {
    const segmentData = emissionFactors[marketSegment as keyof typeof emissionFactors];
    if (segmentData) {
      const factor = segmentData[fuelType as keyof typeof segmentData];
      if (factor !== undefined) {
        // Calculate total emissions in kg CO2e
        const totalEmissionsKg = factor * distanceKm;
        if (totalEmissionsKg < 1) {
          return `${(totalEmissionsKg).toFixed(1)}kg CO₂`;
        } else {
          return `${totalEmissionsKg.toFixed(1)}kg CO₂`;
        }
      }
    }
    return "N/A";
  };

  // Public transport cost calculation function
  const calculatePublicTransportCost = (distance: number, durationMinutes: number, transitTypes: string[]): string => {
    // Check if train is involved
    const hasTrainService = transitTypes.some(type => 
      type.toLowerCase().includes('train') || type.toLowerCase().includes('rail')
    );
    
    if (hasTrainService) {
      // Train pricing: distance_km * 1.5 CZK/km
      const trainCost = distance * 1.5;
      return `${Math.round(trainCost)} CZK`;
    } else {
      // Other transport (tram, metro, bus): time-based pricing
      if (durationMinutes < 30) {
        return "30 CZK";
      } else if (durationMinutes <= 90) {
        return "40 CZK";
      } else {
        return "120 CZK";
      }
    }
  };

  // Calculate car trip cost based on distance and selected car
  const calculateCarCost = (distanceKm: number): string => {
    console.log('DEBUG: calculateCarCost called with:', { distanceKm, selectedCar, carsDatabase: carsDatabase.length });
    if (!selectedCar || !carsDatabase.length || distanceKm <= 0) return "N/A";

    const trip = {
      carModel: `${selectedCar.brand} ${selectedCar.model}`,
      distance: distanceKm.toString(),
    };

    const cost = getCarCost(trip, carsDatabase, czFuelPrices);
    console.log('DEBUG: calculateCarCost result:', cost);
    return cost > 0 ? `${Math.round(cost)} CZK` : "N/A";
  };

  // Update transport options to use calculated costs
  const transportOptions: TransportOption[] = [
    {
      id: "1",
      type: "By car",
      time: calculatedDurations["DRIVING"] || "25 minutes",
      cost: routeInfo ? calculateCarCost(parseFloat(routeInfo.distance)) : "150 CZK",
      emissions: selectedCar && routeInfo 
        ? calculateRealEmissions(selectedCar.fuelType, selectedCar.marketSegment, parseFloat(routeInfo.distance))
        : "1.2kg CO₂",
      isEcoFriendly: selectedCar ? selectedCar.fuelType.includes("Electric") || selectedCar.fuelType === "Hybrid" : false,
      icon: <CarFront className="h-6 w-6" />,
      iconBg: "bg-sky-100",
      iconColor: "text-sky-500",
      buttonColor: "text-sky-700 border-sky-300 hover:bg-sky-100",
      travelMode: "DRIVING",
    },
    {
      id: "2",
      type: "Public transport",
      time: calculatedDurations["TRANSIT"] || "45 minutes",
      cost: calculatedCosts["TRANSIT"] || "30 CZK",
      emissions: "0.3kg CO₂",
      isEcoFriendly: true,
      icon: <Bus className="h-6 w-6" />,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-500",
      buttonColor: "text-orange-700 border-orange-300 hover:bg-orange-100",
      travelMode: "TRANSIT",
    },
    {
      id: "3",
      type: "Walking",
      time: calculatedDurations["WALKING"] || "75 minutes",
      cost: "0 CZK",
      emissions: "0kg CO₂",
      isEcoFriendly: true,
      icon: <PersonStanding className="h-6 w-6" />,
      iconBg: "bg-teal-100",
      iconColor: "text-teal-500",
      buttonColor: "text-teal-700 border-teal-300 hover:bg-teal-100",
      travelMode: "WALKING",
    },
  ];

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: 'AIzaSyBRo02cp0UMrfbZuCFebqgyr0Wj-eV_kZM',
        version: 'weekly',
      });

      try {
        await loader.load();
        setIsGoogleMapsLoaded(true);
        
        if (mapRef.current) {
          const mapInstance = new google.maps.Map(mapRef.current, {
            center: { lat: 50.0755, lng: 14.4378 },
            zoom: 14,
            styles: [
              {
                featureType: 'all',
                stylers: [{ saturation: -80 }, { lightness: 20 }]
              }
            ]
          });

          const directionsServiceInstance = new google.maps.DirectionsService();
          const directionsRendererInstance = new google.maps.DirectionsRenderer({
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: '#3B82F6',
              strokeWeight: 4,
            }
          });
          directionsRendererInstance.setMap(mapInstance);

          setMap(mapInstance);
          setDirectionsService(directionsServiceInstance);
          setDirectionsRenderer(directionsRendererInstance);

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const userLocation = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };
                setCurrentLocation(userLocation);
                setStartLocation('Current Location');
                mapInstance.setCenter(userLocation);
                
                new google.maps.Marker({
                  position: userLocation,
                  map: mapInstance,
                  title: 'Your Location',
                  icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="%2310B981"%3E%3Ccircle cx="12" cy="12" r="8"/%3E%3Ccircle cx="12" cy="12" r="3" fill="%23FFFFFF"/%3E%3C/svg%3E',
                    scaledSize: new google.maps.Size(20, 20),
                  },
                });
              },
              (error) => {
                console.warn('Geolocation service failed:', error);
              }
            );
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  const useCurrentLocation = () => {
    if (currentLocation) {
      setStartLocation('Current Location');
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(userLocation);
          setStartLocation('Current Location');
          if (map) {
            map.setCenter(userLocation);
          }
        },
        () => {
          alert('Unable to get your current location.');
        }
      );
    }
  };

  const handleSearch = () => {
    if (startLocation && destination && isGoogleMapsLoaded) {
      setShowOptions(true);
      calculateAllRoutes();
    }
  };

  const calculateAllRoutes = async () => {
    const modes = ["DRIVING", "TRANSIT", "WALKING"];
    const durations: {[key: string]: string} = {};
    const costs: {[key: string]: string} = {};

    for (const mode of modes) {
      try {
        const result = await calculateRouteForMode(mode);
        if (result) {
          durations[mode] = result.duration;
          if (mode === "TRANSIT") {
            costs[mode] = result.cost;
          }
        }
      } catch (error) {
        console.warn(`Failed to calculate route for ${mode}:`, error);
      }
    }

    setCalculatedDurations(durations);
    setCalculatedCosts(costs);
    
    // Only calculate default driving route if no transport option is selected
    if (!selectedTransportOption) {
      calculateRoute("DRIVING", "By car");
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${hours}h ${remainingMinutes} min`;
      }
    }
  };

  const calculateRouteForMode = (travelMode: string): Promise<{duration: string, cost: string} | null> => {
    return new Promise((resolve) => {
      if (!currentLocation || !directionsService || !isGoogleMapsLoaded) {
        resolve(null);
        return;
      }

      const origin = startLocation === 'Current Location' ? currentLocation : startLocation;
      const googleTravelMode = convertTravelMode(travelMode);

      const requestOptions: google.maps.DirectionsRequest = {
        origin: origin,
        destination: destination,
        travelMode: googleTravelMode,
      };

      directionsService.route(
        requestOptions,
        (response: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
          if (status === 'OK' && response) {
            try {
              const leg = response.routes[0].legs[0];
              if (leg && leg.duration) {
                const durMin = Math.ceil(leg.duration.value / 60);
                const formattedDuration = formatDuration(durMin);
                
                let cost = "N/A";
                if (travelMode === "TRANSIT") {
                  const distanceKm = leg.distance ? leg.distance.value / 1000 : 0;
                  const transitTypes = getTransitTypesFromResponse(response);
                  cost = calculatePublicTransportCost(distanceKm, durMin, transitTypes);
                }
                
                const result = { duration: formattedDuration, cost };
                resolve(result);
              } else {
                resolve(null);
              }
            } catch (error) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  const convertTravelMode = (mode: string): google.maps.TravelMode => {
    if (!isGoogleMapsLoaded || typeof google === 'undefined') {
      return 'DRIVING' as any;
    }
    
    switch (mode) {
      case 'TRANSIT':
        return google.maps.TravelMode.TRANSIT;
      case 'WALKING':
        return google.maps.TravelMode.WALKING;
      case 'BICYCLING':
        return google.maps.TravelMode.BICYCLING;
      case 'DRIVING':
      default:
        return google.maps.TravelMode.DRIVING;
    }
  };

  const getTransitTypesFromResponse = (response: google.maps.DirectionsResult): string[] => {
    const leg = response.routes[0].legs[0];
    if (!leg || !leg.steps) return [];

    const transitTypes: string[] = [];
    
    leg.steps.forEach(step => {
      if (step.travel_mode === google.maps.TravelMode.TRANSIT && step.transit) {
        const line = step.transit.line;
        if (line && line.vehicle) {
          const vehicleType = line.vehicle.type;
          switch (vehicleType) {
            case google.maps.VehicleType.BUS:
              transitTypes.push("Bus");
              break;
            case google.maps.VehicleType.RAIL:
              transitTypes.push("Train");
              break;
            case google.maps.VehicleType.SUBWAY:
              transitTypes.push("Subway");
              break;
            case google.maps.VehicleType.TRAM:
              transitTypes.push("Tram");
              break;
            case google.maps.VehicleType.TROLLEYBUS:
              transitTypes.push("Trolley");
              break;
            default:
              transitTypes.push("Transit");
          }
        }
      }
    });

    return Array.from(new Set(transitTypes)); // Remove duplicates
  };

  const calculateRoute = (travelMode: string, transportType: string) => {
    if (!currentLocation || !directionsService || !directionsRenderer || !isGoogleMapsLoaded) {
      return;
    }

    const origin = startLocation === 'Current Location' ? currentLocation : startLocation;
    const googleTravelMode = convertTravelMode(travelMode);

    const requestOptions: google.maps.DirectionsRequest = {
      origin: origin,
      destination: destination,
      travelMode: googleTravelMode,
    };

    directionsService.route(
      requestOptions,
      (response: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === 'OK' && response) {
          try {
            directionsRenderer.setDirections(response);
            
            const leg = response.routes[0].legs[0];
            if (leg && leg.distance && leg.duration) {
              const distKm = (leg.distance.value / 1000).toFixed(1);
              const durMin = Math.ceil(leg.duration.value / 60);
              
              const eta = new Date(Date.now() + leg.duration.value * 1000)
                .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              let displayTransportType = transportType;
              let transitTypes: string[] = [];
              if (travelMode === "TRANSIT") {
                const transitDetails = getTransitTypesFromResponse(response).join(" + ");
                transitTypes = getTransitTypesFromResponse(response);
                if (transitDetails) {
                  displayTransportType = `Public Transport (${transitDetails})`;
                }
              }
              
              const newRouteInfo = {
                distance: distKm,
                duration: formatDuration(durMin),
                eta: eta,
                selectedTransport: displayTransportType,
                transitTypes: transitTypes
              };
              
              setRouteInfo(newRouteInfo);
            } else {
              setRouteInfo(null);
            }
          } catch (error) {
            setRouteInfo(null);
          }
        } else {
          setRouteInfo(null);
        }
      }
    );
  };

  const selectTransportOption = (option: TransportOption) => {
    setSelectedTransportOption(option);
    calculateRoute(option.travelMode, option.type);
  };

  // Load cars database on component mount
  useEffect(() => {
    const loadCarsData = async () => {
      try {
        const response = await fetch('/data/cars.json');
        const cars = await response.json();
        setCarsDatabase(cars);
      } catch (error) {
        console.error('Failed to load cars data:', error);
      }
    };
    loadCarsData();
  }, []);

  // Default car selection
  useEffect(() => {
    if (carsDatabase.length > 0 && !selectedCar) {
      const defaultCar = carsDatabase.find(car => 
        car.brand === "Volkswagen" && car.model === "Golf GTE"
      ) || carsDatabase[0];
      
      if (defaultCar) {
        setSelectedCar(defaultCar);
      }
    }
  }, [carsDatabase]);

  // Load users from users.json
  useEffect(() => {
    fetch('/data/users.json')
      .then(res => res.json())
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  return (
    <div className="bg-slate-100 min-h-screen p-4 flex justify-center items-start">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open menu</span>
          </Button>
          <Link href="/dashboard" passHref legacyBehavior>
            <Button asChild variant="secondary" className="rounded-full px-4 py-1 text-sm font-semibold">
              <span>Dashboard</span>
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowUserModal(true)}>
            <User className="h-6 w-6" />
            <span className="sr-only">User profile</span>
          </Button>
        </header>

        {/* Inputs Section */}
        <div className="px-4 space-y-3 mt-2">
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Current Location"
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              className="pl-10 pr-3 py-3 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500"
              onClick={useCurrentLocation}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Where to?"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="pl-10 pr-3 py-3 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="bg-slate-100 p-3 rounded-xl flex items-center justify-between cursor-pointer" onClick={() => setShowCarModal(true)}>
            <div className="flex items-center space-x-2">
              <CarFront className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-700">{selectedCar ? `${selectedCar.brand} ${selectedCar.model}` : 'Standard vehicle'}</span>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </div>

          <Button 
            onClick={handleSearch}
            disabled={!startLocation || !destination || isLoading || !isGoogleMapsLoaded}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl"
          >
            Find Routes
          </Button>
        </div>

        {/* Map Placeholder */}
        <div className="px-4 mt-4">
          <div className="aspect-[4/3] bg-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
            <div ref={mapRef} className="w-full h-full rounded-2xl" />
            {!showOptions && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50">
                <MapPin className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Route Options */}
        {showOptions && (
          <div className="p-4 space-y-3 mt-2">
            {transportOptions.map((option) => (
              <Card key={option.id} className="bg-slate-100 border-transparent rounded-xl shadow-none">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`${option.iconBg} p-2 rounded-lg`}>
                      <div className={option.iconColor}>{option.icon}</div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{option.type}</p>
                      <p className="text-xs text-gray-500">
                        <span>{option.time}</span>
                        <span className="mx-1.5">{option.cost}</span>
                        <span className="mx-1.5">{option.emissions}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${option.buttonColor} rounded-full px-4 py-1 text-xs`}
                    onClick={() => selectTransportOption(option)}
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User Selection Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
              <h3 className="font-bold mb-4 text-lg">Select User</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map(user => (
                  <button
                    key={user.userId}
                    className={`w-full text-left p-3 rounded-xl hover:bg-slate-100 ${selectedUser?.userId === user.userId ? 'bg-sky-100 font-bold' : ''}`}
                    onClick={() => { setSelectedUser(user); setShowUserModal(false); }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{user.userId}</span>
                      <span className="text-xs text-gray-500">{user.department}</span>
                    </div>
                    <div className="text-xs text-gray-400">{user.carModel}</div>
                  </button>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowUserModal(false)}>Close</Button>
            </div>
          </div>
        )}

        {/* Car Selection Modal */}
        {showCarModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
              <h3 className="font-bold mb-4 text-lg">Select Car</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {carsDatabase.filter(car => !selectedUser || car.fuelType === selectedUser.fuelType).map(car => (
                  <button
                    key={car.id}
                    className={`w-full text-left p-3 rounded-xl hover:bg-slate-100 ${selectedCar?.id === car.id ? 'bg-sky-100 font-bold' : ''}`}
                    onClick={() => { setSelectedCar(car); setShowCarModal(false); }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{car.brand} {car.model}</span>
                      <span className="text-xs text-gray-500">{car.fuelType}</span>
                    </div>
                    <div className="text-xs text-gray-400">{car.efficiency}</div>
                  </button>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowCarModal(false)}>Close</Button>
            </div>
          </div>
        )}

        {/* Let's Ride Button */}
        {selectedTransportOption && routeInfo && (
          <div className="p-4 mt-2">
            <Button 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-lg"
              onClick={async () => {
                // Save trip to /api/save-trip
                const tripData = {
                  userId: selectedUser?.userId || 'guest',
                  userDepartment: selectedUser?.department || '',
                  userFuelType: selectedUser?.fuelType || '',
                  userMarketSegment: selectedUser?.marketSegment || '',
                  carBrand: selectedCar?.brand || '',
                  carModel: selectedCar?.model || '',
                  carFuelType: selectedCar?.fuelType || '',
                  carEfficiency: selectedCar?.efficiency || '',
                  distance: routeInfo.distance,
                  duration: routeInfo.duration,
                  co2Emissions: selectedCar && routeInfo 
                    ? calculateRealEmissions(selectedCar.fuelType, selectedCar.marketSegment, parseFloat(routeInfo.distance))
                    : 'N/A',
                  transportType: selectedTransportOption.type,
                  cost: selectedTransportOption.cost,
                  startLocation: startLocation,
                  destination: destination,
                  scheduledDateTime: scheduledDateTime,
                  tripTimestamp: ''
                };
                try {
                  const response = await fetch('/api/save-trip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tripData),
                  });
                  const result = await response.json();
                  if (result.success) {
                    alert('Trip saved!');
                  } else {
                    alert('Failed to save trip.');
                  }
                } catch (e) {
                  alert('Error saving trip.');
                }
              }}
            >
              Let's Ride
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapsRouting; 