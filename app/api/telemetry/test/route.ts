import { NextResponse } from 'next/server';

// GET handler - returns static test data
export async function GET() {
  // Create static test data
  const testData = {
    battery: {
      id: 1,
      voltage: 3.85,
      percentage: 87.5,
      current: 0.32,
      status: "Discharging",
      timestamp: new Date().toISOString()
    },
    temperature: {
      id: 1,
      voltage: 0.28,
      temperature: 28.0,
      timestamp: new Date().toISOString()
    },
    gnss: {
      id: 1,
      latitude: 40.7128,
      longitude: -74.0060,
      altitude: 10.2,
      hdop: 0.9,
      satellites: 8,
      fixType: 1,
      rawNMEA: "$GPGGA,123519,4007.7680,N,07400.3600,W,1,08,0.9,10.2,M,,M,,*47",
      timestamp: new Date().toISOString()
    },
    gas: {
      CO: {
        id: 1,
        sensorType: "CO",
        sensorValue: 270,
        timestamp: new Date().toISOString()
      },
      NO2: {
        id: 1,
        sensorType: "NO2",
        sensorValue: 120,
        timestamp: new Date().toISOString()
      },
      SO2: {
        id: 1,
        sensorType: "SO2",
        sensorValue: 160,
        timestamp: new Date().toISOString()
      }
    }
  };
  
  return NextResponse.json(testData, { status: 200 });
} 