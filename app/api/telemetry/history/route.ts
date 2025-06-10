import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET handler - returns historical telemetry data with pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Pagination parameters
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;
    
    // Sensor type filter
    const sensorType = searchParams.get('sensorType'); // 'battery', 'temperature', 'gnss', 'gas'
    const gasType = searchParams.get('gasType'); // 'CO', 'NO2', 'SO2'

    // Time range filter
    const startTime = searchParams.get('startTime') 
      ? new Date(searchParams.get('startTime') || '') 
      : undefined;
    const endTime = searchParams.get('endTime') 
      ? new Date(searchParams.get('endTime') || '') 
      : undefined;

    // Build time filter
    const timeFilter = {};
    if (startTime || endTime) {
      timeFilter.timestamp = {};
      if (startTime) timeFilter.timestamp.gte = startTime;
      if (endTime) timeFilter.timestamp.lte = endTime;
    }

    // Fetch data based on sensor type
    let data = [];
    let total = 0;

    if (!sensorType || sensorType === 'battery') {
      const [batteryData, batteryCount] = await Promise.all([
        prisma.batteryData.findMany({
          where: timeFilter,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.batteryData.count({ where: timeFilter })
      ]);
      data = batteryData;
      total = batteryCount;
    } else if (sensorType === 'temperature') {
      const [temperatureData, temperatureCount] = await Promise.all([
        prisma.temperatureData.findMany({
          where: timeFilter,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.temperatureData.count({ where: timeFilter })
      ]);
      data = temperatureData;
      total = temperatureCount;
    } else if (sensorType === 'gnss') {
      const [gnssData, gnssCount] = await Promise.all([
        prisma.gnssData.findMany({
          where: timeFilter,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.gnssData.count({ where: timeFilter })
      ]);
      data = gnssData;
      total = gnssCount;
    } else if (sensorType === 'gas') {
      // Additional filter for gas type
      const gasFilter = {
        ...timeFilter,
        ...(gasType ? { sensorType: gasType } : {})
      };
      
      const [gasData, gasCount] = await Promise.all([
        prisma.gasData.findMany({
          where: gasFilter,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.gasData.count({ where: gasFilter })
      ]);
      data = gasData;
      total = gasCount;
    }

    // Return data with pagination info
    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch historical telemetry data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical telemetry data' }, 
      { status: 500 }
    );
  }
} 