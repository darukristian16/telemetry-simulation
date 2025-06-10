import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  BatteryDataGenerator,
  TemperatureDataGenerator,
  GNSSDataGenerator,
  createGasGenerators,
  GasType
} from '@/lib/generators';

// Create generator instances
const batteryGenerator = new BatteryDataGenerator();
const temperatureGenerator = new TemperatureDataGenerator();
const gnssGenerator = new GNSSDataGenerator();
const gasGenerators = createGasGenerators();

// Generate fresh telemetry data and save to database
async function generateAndSaveTelemetryData() {
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

    try {
      // Try to save data to database
      await Promise.all([
        prisma.batteryData.create({ data: batteryData }),
        prisma.temperatureData.create({ data: temperatureData }),
        prisma.gnssData.create({ data: gnssData }),
        ...gasData.map(data => prisma.gasData.create({ data }))
      ]);
    } catch (dbError) {
      console.error('Database save failed:', dbError);
      // Return data even if DB save fails
    }

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

// GET handler - returns the latest telemetry data
export async function GET() {
  try {
    // Generate telemetry data
    const telemetryData = await generateAndSaveTelemetryData();
    
    return NextResponse.json(telemetryData, { status: 200 });
  } catch (error) {
    // Provide more detailed error information
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error generating telemetry data';
    
    console.error('Fatal error in telemetry API:', errorMessage, error);
    
    // Return a more descriptive error response
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