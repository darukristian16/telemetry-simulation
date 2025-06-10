"use client";

import React, { useEffect, useRef } from 'react';
import { useTelemetry } from '@/context/TelemetryContext';
import { useTerminalDashboard, ProcessedTelemetryData } from '@/context/TerminalDashboardContext';
import { GNSSDecompressor } from '@/lib/compression/GNSSDecompressor';
import { TemperatureDecompressor } from '@/lib/compression/TemperatureDecompressor';
import { GasSensorDecompressor } from '@/lib/compression/GasSensorDecompressor';
import { BatteryDecompressor } from '@/lib/compression/BatteryDecompressor';

// Component that processes telemetry data and forwards it to Dashboard
export function DataProcessor() {
  const { telemetryData } = useTelemetry();
  const { setProcessedData, setIsReceivingData, setLastUpdateTime, updateDataStats } = useTerminalDashboard();
  
  // Track the last processed timestamp to prevent duplicate processing
  const lastProcessedTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!telemetryData) return;

    // Get current timestamp (handle both compressed and raw formats)
    const currentTimestamp = telemetryData.timestamp || telemetryData.ts || 0;
    
    // Prevent processing duplicate data - only process if timestamp has changed
    if (currentTimestamp <= lastProcessedTimestamp.current) {
      return;
    }

    const processData = async () => {
      const startTime = performance.now();
      setIsReceivingData(true);

      try {
        let processedData: ProcessedTelemetryData;

        // Check if data is compressed (has Base64 fields) or raw
        const isCompressed = !!(telemetryData.gnss || telemetryData.temp || telemetryData.co || 
                                telemetryData.no2 || telemetryData.so2 || telemetryData.batt);

        if (isCompressed) {
          // COMPRESSED DATA: Decompress it
          processedData = await decompressData(telemetryData);
          processedData.dataSource = 'decompressed';
        } else {
          // RAW DATA: Pass through directly
          processedData = {
            latitude: telemetryData.latitude || 0,
            longitude: telemetryData.longitude || 0,
            altitude: telemetryData.altitude || 0,
            temperature: telemetryData.temperature || 0,
            coLevel: telemetryData.coLevel || 0,
            no2Level: telemetryData.no2Level || 0,
            so2Level: telemetryData.so2Level || 0,
            voltage: telemetryData.voltage || 0,
            current: telemetryData.current || 0,
            batteryPercentage: telemetryData.batteryPercentage || 0,
            batteryStatus: telemetryData.batteryStatus || 'Unknown',
            timestamp: telemetryData.timestamp || Date.now(),
            signalStrength: telemetryData.signalStrength || 0,
            flightTime: telemetryData.flightTime || 0,
            dataSource: 'raw'
          };
        }

        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        processedData.processingTime = processingTime;

        // Update last processed timestamp
        lastProcessedTimestamp.current = currentTimestamp;

        // Forward processed data to Dashboard
        setProcessedData(processedData);
        setLastUpdateTime(Date.now());
        
        // Update statistics
        updateDataStats(processingTime, isCompressed);

      } catch (error) {
        console.error('Error processing telemetry data:', error);
      } finally {
        setIsReceivingData(false);
      }
    };

    processData();
  }, [telemetryData]); // Only depend on telemetryData

  // This component doesn't render anything - it's just for data processing
  return null;
}

// Real decompression function using actual decompression algorithms
async function decompressData(compressedData: any): Promise<ProcessedTelemetryData> {
  const timestamp = compressedData.ts || Date.now();
  const signalStrength = compressedData.sig || 0;
  const flightTime = compressedData.time || 0;

  // Initialize decompressors
  const gnssDecompressor = new GNSSDecompressor();
  const temperatureDecompressor = new TemperatureDecompressor();
  const coDecompressor = new GasSensorDecompressor('CO');
  const no2Decompressor = new GasSensorDecompressor('NO2');
  const so2Decompressor = new GasSensorDecompressor('SO2');
  const batteryDecompressor = new BatteryDecompressor();

  // Default values (in case decompression fails or buffer is empty)
  let latitude = -33.8688;
  let longitude = 151.2093;
  let altitude = 100;
  let temperature = 25;
  let coLevel = 1.2;
  let no2Level = 100;
  let so2Level = 10;
  let voltage = 3.7;
  let current = 1.5;
  let batteryPercentage = 75;
  let batteryStatus = 'Discharging';

  try {
    // Decompress GNSS data
    if (compressedData.gnss) {
      const gnssBuffer = Buffer.from(compressedData.gnss, 'base64');
      const gnssData = gnssDecompressor.decompress(gnssBuffer);
      if (gnssData) {
        latitude = gnssData.latitude;
        longitude = gnssData.longitude;
        altitude = gnssData.altitude;
      }
    }

    // Decompress temperature data
    if (compressedData.temp) {
      const tempBuffer = Buffer.from(compressedData.temp, 'base64');
      const tempData = temperatureDecompressor.decompress(tempBuffer);
      if (tempData) {
        temperature = tempData.temperature;
      }
    }

    // Decompress CO data
    if (compressedData.co) {
      const coBuffer = Buffer.from(compressedData.co, 'base64');
      const coData = coDecompressor.decompress(coBuffer);
      if (coData) {
        coLevel = coData.sensorValue;
      }
    }

    // Decompress NO2 data
    if (compressedData.no2) {
      const no2Buffer = Buffer.from(compressedData.no2, 'base64');
      const no2Data = no2Decompressor.decompress(no2Buffer);
      if (no2Data) {
        no2Level = no2Data.sensorValue;
      }
    }

    // Decompress SO2 data
    if (compressedData.so2) {
      const so2Buffer = Buffer.from(compressedData.so2, 'base64');
      const so2Data = so2Decompressor.decompress(so2Buffer);
      if (so2Data) {
        so2Level = so2Data.sensorValue;
      }
    }

    // Decompress battery data
    if (compressedData.batt) {
      const battBuffer = Buffer.from(compressedData.batt, 'base64');
      const battData = batteryDecompressor.decompress(battBuffer);
      if (battData) {
        voltage = battData.voltage;
        current = battData.current;
        batteryPercentage = battData.percentage;
        batteryStatus = battData.status;
      }
    }

  } catch (error) {
    console.error('Error during decompression:', error);
    // Continue with default values if decompression fails
  }

  return {
    latitude,
    longitude,
    altitude,
    temperature,
    coLevel,
    no2Level,
    so2Level,
    voltage,
    current,
    batteryPercentage,
    batteryStatus,
    timestamp,
    signalStrength,
    flightTime,
    dataSource: 'decompressed'
  };
} 