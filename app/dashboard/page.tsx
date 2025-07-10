// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  BatteryFull,
  ArrowUp,
  Zap,
  Clock,
  Thermometer,
  Wind,
  Maximize,
  MapPin,
  CheckCircle,
  BatteryCharging,
  Snowflake,
  Flame,
  Sun,
} from "lucide-react";
import { useTerminalDashboard } from "@/context/TerminalDashboardContext";
import { formatDistanceToNow } from 'date-fns';
import dynamic from 'next/dynamic';
import { UnifiedSerialConnection } from "@/components/unified-serial-connection";

import { DataProcessor } from "@/components/DataProcessor";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import { 
  FullPageContent,
  SidebarProvider,
} from "@/components/ui/sidebar";

// Dynamically import the MapView component with no SSR
// This is necessary because Leaflet requires browser APIs
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full flex items-center justify-center rounded bg-gray-700 text-gray-400">
      Loading map...
    </div>
  )
});

// Helper component for Stats Cards
interface StatCardProps {
  title: string;
  value: string;
  secondaryText: string;
  icon: React.ElementType;
  iconColorClass?: string;
}

function StatCard({ title, value, secondaryText, icon: Icon, iconColorClass = "text-blue-500" }: StatCardProps) {
  return (
    <div className="rounded-lg bg-gray-800 p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        <Icon className={`h-5 w-5 ${iconColorClass}`} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{secondaryText}</p>
    </div>
  );
}

// Helper component for Progress Bar
interface ProgressBarProps {
  value: number;
  colorClass: string;
}

function ProgressBar({ value, colorClass }: ProgressBarProps) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-600">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// Generic Gas Progress Bar showing danger zones
interface GasProgressBarProps {
  value: number;
  percentage: number;
  gasType: 'co' | 'no2' | 'so2';
}

function GasProgressBar({ value, percentage, gasType }: GasProgressBarProps) {
  const getColorBasedOnValue = (value: number, gasType: string) => {
    switch(gasType) {
      case 'co':
        return value <= 9 ? '#10B981' : 
               value <= 70 ? '#EAB308' : 
               value <= 150 ? '#EF4444' : '#991B1B';
      case 'no2':
        return value <= 50 ? '#10B981' : 
               value <= 200 ? '#EAB308' : 
               value <= 5000 ? '#EF4444' : '#991B1B';
      case 'so2':
        return value <= 50 ? '#10B981' : 
               value <= 500 ? '#EAB308' : 
               value <= 5000 ? '#EF4444' : '#991B1B';
      default:
        return '#10B981';
    }
  };

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-600 relative">
      {/* Background danger zones */}
      <div className="absolute inset-0 flex">
        {/* Safe zone (0-25% of bar) */}
        <div className="w-1/4 bg-green-500 opacity-30"></div>
        {/* Caution zone (25-50% of bar) */}
        <div className="w-1/4 bg-yellow-500 opacity-30"></div>
        {/* Dangerous zone (50-75% of bar) */}
        <div className="w-1/4 bg-red-500 opacity-30"></div>
        {/* Life-threatening zone (75-100% of bar) */}
        <div className="w-1/4 bg-red-800 opacity-30"></div>
      </div>
      
      {/* Current value indicator */}
      <div
        className="h-full rounded-full relative z-10"
        style={{ 
          width: `${percentage}%`,
          background: getColorBasedOnValue(value, gasType)
        }}
      />
      
      {/* Zone dividers */}
      <div className="absolute inset-0 flex">
        <div className="w-1/4 border-r border-gray-400 opacity-50"></div>
        <div className="w-1/4 border-r border-gray-400 opacity-50"></div>
        <div className="w-1/4 border-r border-gray-400 opacity-50"></div>
        <div className="w-1/4"></div>
      </div>
    </div>
  );
}

// Helper to format flight time
function formatFlightTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    remainingSeconds.toString().padStart(2, '0')
  ].join(':');
}

// Connect Status Wrapper Component
function ConnectStatusWrapper() {
  return <UnifiedSerialConnection />;
}

export default function DashboardPage() {
  // Use the terminal dashboard context to get processed data
  const { processedData, isReceivingData, dataStats, lastUpdateTime } = useTerminalDashboard();
  
  // State for real-time idle time updates
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Real-time update for idle time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);


  
  // Calculate battery color based on percentage
  const batteryColorClass = (processedData?.batteryPercentage || 0) > 50 
    ? "text-green-500" 
    : (processedData?.batteryPercentage || 0) > 20 
      ? "text-yellow-500" 
      : "text-red-500";

  // Determine battery icon based on charging status
  const batteryIcon = processedData?.batteryStatus === "Charging" ? BatteryCharging : BatteryFull;

  // Multiple flame component for extreme heat
  const MultipleFlames = ({ className }: { className: string }) => (
    <div className="flex items-center -space-x-1">
      <Flame className="h-4 w-4 text-orange-500" />
      <Flame className="h-5 w-5 text-orange-500" />
      <Flame className="h-4 w-4 text-orange-500" />
    </div>
  );

  // Determine temperature icon and color based on temperature value
  const temperature = processedData?.temperature || 0;
  const getTemperatureIconAndColor = (temp: number) => {
    if (temp < 20) {
      return { icon: Snowflake, colorClass: "text-blue-400" }; // Cold
    } else if (temp > 60) {
      return { icon: MultipleFlames, colorClass: "text-orange-500" }; // Extreme Hot
    } else if (temp > 40) {
      return { icon: Flame, colorClass: "text-red-500" }; // Hot
    } else {
      return { icon: Thermometer, colorClass: "text-green-500" }; // Normal
    }
  };

  const temperatureDisplay = getTemperatureIconAndColor(temperature);

  // Calculate temperature position on gradient (0-100 scale, where 0°C = 0% and 100°C = 100%)
  const getTemperaturePosition = (temp: number) => {
    const minTemp = 0;
    const maxTemp = 100;
    const position = Math.max(0, Math.min(100, ((temp - minTemp) / (maxTemp - minTemp)) * 100));
    return position;
  };

  const temperaturePosition = getTemperaturePosition(temperature);

  // Get compression performance text
  const getCompressionPerformanceText = (ratio: number) => {
    if (ratio > 3) return "Excellent";
    if (ratio > 2) return "Good";
    if (ratio > 1.5) return "Fair";
    return "Poor";
  };

  // Get latency performance text with more realistic ranges
  const getLatencyPerformanceText = (latency: number) => {
    if (latency < 10) return "Excellent";
    if (latency < 50) return "Good";
    if (latency < 200) return "Fair";
    if (latency < 500) return "Poor";
    return "Very High";
  };

  // Format coordinates for display
  const formatCoordinate = (coord: number, isLatitude: boolean) => {
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = ((absolute - degrees - minutes/60) * 3600).toFixed(2);
    const direction = isLatitude 
      ? (coord >= 0 ? "N" : "S")
      : (coord >= 0 ? "E" : "W");
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };

  // Function to get CO danger level and colors
  const getCODangerLevel = (coPpm: number) => {
    if (coPpm <= 9) {
      return { 
        level: "Safe", 
        color: "bg-green-500", 
        textColor: "text-green-400",
        percentage: Math.min(100, (coPpm / 9) * 25) // 0-25% of bar for 0-9ppm
      };
    } else if (coPpm <= 70) {
      return { 
        level: "Caution", 
        color: "bg-yellow-500", 
        textColor: "text-yellow-400",
        percentage: 25 + Math.min(100, ((coPpm - 9) / (70 - 9)) * 25) // 25-50% of bar for 10-70ppm
      };
    } else if (coPpm <= 150) {
      return { 
        level: "Dangerous", 
        color: "bg-red-500", 
        textColor: "text-red-400",
        percentage: 50 + Math.min(100, ((coPpm - 70) / (150 - 70)) * 25) // 50-75% of bar for 71-150ppm
      };
    } else {
      return { 
        level: "Life-threatening", 
        color: "bg-red-800", 
        textColor: "text-red-600",
        percentage: 75 + Math.min(100, ((coPpm - 150) / 100) * 25) // 75-100% of bar for 151ppm+
      };
    }
  };

  // Function to get NO2 danger level and colors
  const getNO2DangerLevel = (no2Ppb: number) => {
    if (no2Ppb <= 50) {
      return { 
        level: "Safe", 
        color: "bg-green-500", 
        textColor: "text-green-400",
        percentage: Math.min(100, (no2Ppb / 50) * 25) // 0-25% of bar for 0-50ppb
      };
    } else if (no2Ppb <= 200) {
      return { 
        level: "Caution", 
        color: "bg-yellow-500", 
        textColor: "text-yellow-400",
        percentage: 25 + Math.min(100, ((no2Ppb - 50) / (200 - 50)) * 25) // 25-50% of bar for 51-200ppb
      };
    } else if (no2Ppb <= 5000) {
      return { 
        level: "Dangerous", 
        color: "bg-red-500", 
        textColor: "text-red-400",
        percentage: 50 + Math.min(100, ((no2Ppb - 200) / (5000 - 200)) * 25) // 50-75% of bar for 201-5000ppb
      };
    } else {
      return { 
        level: "Life-threatening", 
        color: "bg-red-800", 
        textColor: "text-red-600",
        percentage: 75 + Math.min(100, ((no2Ppb - 5000) / 1000) * 25) // 75-100% of bar for >5000ppb
      };
    }
  };

  // Function to get SO2 danger level and colors
  const getSO2DangerLevel = (so2Ppb: number) => {
    if (so2Ppb <= 50) {
      return { 
        level: "Safe", 
        color: "bg-green-500", 
        textColor: "text-green-400",
        percentage: Math.min(100, (so2Ppb / 50) * 25) // 0-25% of bar for 0-50ppb
      };
    } else if (so2Ppb <= 500) {
      return { 
        level: "Caution", 
        color: "bg-yellow-500", 
        textColor: "text-yellow-400",
        percentage: 25 + Math.min(100, ((so2Ppb - 50) / (500 - 50)) * 25) // 25-50% of bar for 51-500ppb
      };
    } else if (so2Ppb <= 5000) {
      return { 
        level: "Dangerous", 
        color: "bg-red-500", 
        textColor: "text-red-400",
        percentage: 50 + Math.min(100, ((so2Ppb - 500) / (5000 - 500)) * 25) // 50-75% of bar for 501-5000ppb
      };
    } else {
      return { 
        level: "Life-threatening", 
        color: "bg-red-800", 
        textColor: "text-red-600",
        percentage: 75 + Math.min(100, ((so2Ppb - 5000) / 1000) * 25) // 75-100% of bar for >5000ppb
      };
    }
  };

  // Gas sensor data with calculated percentages for visualization
  const coDangerLevel = getCODangerLevel(processedData?.coLevel || 0);
  const no2DangerLevel = getNO2DangerLevel(processedData?.no2Level || 0);
  const so2DangerLevel = getSO2DangerLevel(processedData?.so2Level || 0);
  
  const gasSensorData = {
    co: { 
      value: processedData?.coLevel || 0, 
      percentage: coDangerLevel.percentage,
      color: coDangerLevel.color,
      dangerLevel: coDangerLevel.level,
      textColor: coDangerLevel.textColor
    },
    no2: { 
      value: processedData?.no2Level || 0, 
      percentage: no2DangerLevel.percentage,
      color: no2DangerLevel.color,
      dangerLevel: no2DangerLevel.level,
      textColor: no2DangerLevel.textColor
    },
    so2: { 
      value: processedData?.so2Level || 0, 
      percentage: so2DangerLevel.percentage,
      color: so2DangerLevel.color,
      dangerLevel: so2DangerLevel.level,
      textColor: so2DangerLevel.textColor
    },
  };

  // Enhanced last update logic
  const getLastUpdateStatus = () => {
    // Show "Live" if currently receiving data or recently active (within 2 seconds)
    if (isReceivingData || (lastUpdateTime && (currentTime - lastUpdateTime) < 2000)) {
      return "Live";
    }
    
    // Show estimated time if we have lastUpdateTime
    if (lastUpdateTime) {
      const idleTime = currentTime - lastUpdateTime;
      const idleSeconds = Math.floor(idleTime / 1000);
      const idleMinutes = Math.floor(idleSeconds / 60);
      const idleHours = Math.floor(idleMinutes / 60);
      
      if (idleHours > 0) {
        if (idleHours === 1) return "one hour ago";
        if (idleHours < 5) return `${idleHours} hours ago`;
        return "several hours ago";
      } else if (idleMinutes > 0) {
        if (idleMinutes === 1) return "one minute ago";
        if (idleMinutes < 5) return `${idleMinutes} minutes ago`;
        if (idleMinutes < 10) return "five minutes ago";
        if (idleMinutes < 15) return "ten minutes ago";
        if (idleMinutes < 30) return "fifteen minutes ago";
        return "half an hour ago";
      } else {
        if (idleSeconds < 10) return "just now";
        if (idleSeconds < 30) return "few seconds ago";
        return "less than a minute ago";
      }
    }
    
    return "Never";
  };

  // System status info
  const systemStatus = {
    lastUpdate: getLastUpdateStatus(),
    flightTime: formatFlightTime(processedData?.flightTime || 0)
  };



  // Map info
  const mapInfo = {
    lat: processedData?.latitude ? formatCoordinate(processedData.latitude, true) : "N/A",
    long: processedData?.longitude ? formatCoordinate(processedData.longitude, false) : "N/A",
    heading: "275°" // This could be calculated based on movement direction
  };

  // Position for the map
  const mapPosition: [number, number] = [processedData?.latitude || 0, processedData?.longitude || 0];

  // Get compression metrics - use actual compression ratio from processed data
  const compressionRatio = (() => {
    if (!processedData) return 1;
    
    // For raw data, compression ratio is always 1:1 (no compression)
    if (processedData.dataSource === 'raw') {
      return 1;
    }
    
    // For compressed data, use the actual compression ratio from metrics
    if (processedData.compressionMetrics?.compressionRatio) {
      return processedData.compressionMetrics.compressionRatio;
    }
    
    // Fallback to estimate if metrics not available
    return dataStats.compressedPackets > 0 ? 3.5 : 1;
  })();
  
  // Improved status logic - show "Active" if data was received recently (within last 5 seconds)
  const isRecentlyActive = lastUpdateTime && (currentTime - lastUpdateTime) < 5000;
  
  // Get processing latency from actual transmission-to-processing time
  // For compressed data: latency + compression time + decompression time
  // For raw data: just the base latency
  const processingLatency = (() => {
    if (!isReceivingData && !isRecentlyActive) return 0;
    
    const baseLatency = processedData?.processingLatency || dataStats.averageLatency || 0;
    
    // For compressed data, add compression and decompression times
    if (processedData?.dataSource === 'decompressed') {
      const compressionTime = processedData?.compressionMetrics?.processingTime || 0;
      const decompressionTime = processedData?.decompressionTime || 0;
      const totalLatency = baseLatency + compressionTime + decompressionTime;
      

      
      return totalLatency;
    }
    
    // For raw data, just return base latency
    return baseLatency;
  })();

  // Calculate latency color based on performance with realistic ranges
  const latencyColorClass = processingLatency < 10 
    ? "text-green-400" 
    : processingLatency < 50 
      ? "text-yellow-400" 
      : processingLatency < 200
        ? "text-orange-400"
        : "text-red-400";
  const currentStatus = isReceivingData || isRecentlyActive ? "Active" : "Standby";
  const statusColorClass = isReceivingData || isRecentlyActive ? "text-green-400" : "text-yellow-400";

  return (
    <FullPageContent>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 48)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <SiteHeader />
        <AppSidebar variant="inset" />
        <div style={{ 
          marginLeft: 0, 
          marginTop: "var(--header-height)",
          padding: "1.5rem",
          flex: "1 1 auto",
          overflow: "auto",
          backgroundColor: "#0F172A"
        }}>
          {/* Hidden components for data processing */}
          <DataProcessor />
          
          <div className="flex h-full flex-col gap-6">
            {/* Unified Serial Connection */}
            <UnifiedSerialConnection />

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Battery Status"
                value={`${(processedData?.batteryPercentage || 0).toFixed(1)}%`}
                secondaryText={`${(processedData?.voltage || 0).toFixed(1)}V | ${(processedData?.current || 0).toFixed(1)}A`}
                icon={batteryIcon}
                iconColorClass={batteryColorClass}
              />
              <StatCard
                title="Altitude"
                value={`${(processedData?.altitude || 0).toFixed(1)}m`}
                secondaryText="Above Sea Level"
                icon={ArrowUp}
                iconColorClass="text-blue-400"
              />
              <StatCard
                title="Compression Ratio"
                value={`${compressionRatio.toFixed(2)}:1`}
                secondaryText={getCompressionPerformanceText(compressionRatio)}
                icon={Zap}
                iconColorClass="text-purple-400"
              />
              <StatCard
                title="Latency"
                value={`${processingLatency.toFixed(1)}ms`}
                secondaryText={getLatencyPerformanceText(processingLatency)}
                icon={Clock}
                iconColorClass={latencyColorClass}
              />
            </div>

            {/* Main Content Grid: Map and Right Sidebar */}
            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Live Location Map Card */}
              <div className="relative rounded-lg bg-gray-800 p-4 shadow lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Live Location</h2>
                  <div className="flex items-center gap-2">
                    <button className="text-gray-400 hover:text-white"><Maximize className="h-5 w-5" /></button>
                    <button className="text-gray-400 hover:text-white"><MapPin className="h-5 w-5" /></button>
                  </div>
                </div>
                
                {/* Map Component */}
                <div className="aspect-video w-full overflow-hidden rounded">
                  <MapView 
                    position={mapPosition} 
                    zoom={14}
                    height="100%"
                    width="100%"
                    popupContent={
                      <div>
                        <div className="font-semibold">UAV Location</div>
                        <div>Latitude: {(processedData?.latitude || 0).toFixed(6)}</div>
                        <div>Longitude: {(processedData?.longitude || 0).toFixed(6)}</div>
                        <div>Altitude: {(processedData?.altitude || 0).toFixed(1)}m</div>
                        <div>Compression: {compressionRatio.toFixed(2)}:1</div>
                        <div>Latency: {processingLatency.toFixed(1)}ms</div>
                      </div>
                    }
                  />
                </div>
                
                {/* Info Overlay */}
                <div className="absolute bottom-6 left-6 rounded bg-black/60 p-2 text-xs text-white backdrop-blur-sm">
                  <div>Lat: {mapInfo.lat}</div>
                  <div>Long: {mapInfo.long}</div>
                  <div>Heading: {mapInfo.heading}</div>
                </div>
              </div>

              {/* Right Column Cards */}
              <div className="flex flex-col gap-6">
                {/* Temperature Card */}
                <div className="rounded-lg bg-gray-800 p-4 shadow">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Temperature</h3>
                    <temperatureDisplay.icon className={`h-5 w-5 ${temperatureDisplay.colorClass}`} />
                  </div>
                  {/* Temperature Chart Placeholder */}
                  <div className="mb-3 h-16 w-full rounded bg-gradient-to-r from-blue-600 via-red-500 to-red-600 opacity-75 relative">
                    {/* Temperature position indicator */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-lg rounded-full"
                      style={{ left: `${temperaturePosition}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                  <p className="text-center text-xl font-semibold text-white">{(processedData?.temperature || 0).toFixed(1)}°C</p>
                </div>

                {/* Gas Sensors Card */}
                <div className="rounded-lg bg-gray-800 p-4 shadow">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Gas Sensors</h3>
                    <Wind className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="space-y-3 text-sm">
                    {/* CO with danger level indicator */}
                    <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-gray-400">CO <span className="text-xs">(PPM)</span></span>
                        <GasProgressBar value={gasSensorData.co.value} percentage={gasSensorData.co.percentage} gasType="co" />
                      <span className="w-12 shrink-0 text-right text-white">{gasSensorData.co.value.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Danger Level:</span>
                        <span className={gasSensorData.co.textColor}>{gasSensorData.co.dangerLevel}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0-9</span>
                        <span>10-70</span>
                        <span>71-150</span>
                        <span>151+</span>
                      </div>
                    </div>
                    
                    {/* NO2 with danger level indicator */}
                    <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="w-12 shrink-0 text-gray-400">NO₂ <span className="text-xs">(PPB)</span></span>
                        <GasProgressBar value={gasSensorData.no2.value} percentage={gasSensorData.no2.percentage} gasType="no2" />
                      <span className="w-12 shrink-0 text-right text-white">{gasSensorData.no2.value.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Danger Level:</span>
                        <span className={gasSensorData.no2.textColor}>{gasSensorData.no2.dangerLevel}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0-50</span>
                        <span>51-200</span>
                        <span>201-5000</span>
                        <span>5000+</span>
                      </div>
                    </div>
                    
                    {/* SO2 with danger level indicator */}
                    <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="w-12 shrink-0 text-gray-400">SO₂ <span className="text-xs">(PPB)</span></span>
                        <GasProgressBar value={gasSensorData.so2.value} percentage={gasSensorData.so2.percentage} gasType="so2" />
                      <span className="w-12 shrink-0 text-right text-white">{gasSensorData.so2.value.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Danger Level:</span>
                        <span className={gasSensorData.so2.textColor}>{gasSensorData.so2.dangerLevel}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0-50</span>
                        <span>51-500</span>
                        <span>501-5000</span>
                        <span>5000+</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Status Card */}
                <div className="rounded-lg bg-gray-800 p-4 shadow">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">System Status</h3>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Update</span>
                      <span className="text-white">{systemStatus.lastUpdate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Flight Time</span>
                      <span className="text-white">{systemStatus.flightTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status</span>
                      <span className={statusColorClass}>{currentStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </FullPageContent>
  );
}