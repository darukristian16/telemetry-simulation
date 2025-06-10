import { NextResponse } from 'next/server';
import {
  BatteryDataGenerator,
  TemperatureDataGenerator,
  GNSSDataGenerator,
  createGasGenerators
} from '@/lib/generators';

// Create generator instances
const batteryGenerator = new BatteryDataGenerator();
const temperatureGenerator = new TemperatureDataGenerator();
const gnssGenerator = new GNSSDataGenerator();
const gasGenerators = createGasGenerators();

// Generate fresh telemetry data without database operations
async function generateTelemetryData() {
  try {
    // Generate data from all sensors
    const batteryData = batteryGenerator.generateData();
    const temperatureData = temperatureGenerator.generateData();
    const gnssData = gnssGenerator.generateData();
    
    // Gas data for all three types
    const gasData = [
      gasGenerators.CO.generateData(),
      gasGenerators.NO2.generateData(),
      gasGenerators.SO2.generateData()
    ];

    // Return the generated data
    return {
      battery: batteryData,
      temperature: temperatureData,
      gnss: gnssData,
      gas: {
        CO: gasData[0],
        NO2: gasData[1],
        SO2: gasData[2]
      }
    };
  } catch (generateError) {
    console.error('Failed to generate telemetry data:', generateError);
    throw generateError;
  }
}

// GET handler - returns generated telemetry data
export async function GET() {
  try {
    // Generate telemetry data
    const telemetryData = await generateTelemetryData();
    
    return NextResponse.json(telemetryData, { status: 200 });
  } catch (error) {
    // Provide detailed error information
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error generating telemetry data';
    
    console.error('Fatal error in telemetry generate API:', errorMessage, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate telemetry data', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 