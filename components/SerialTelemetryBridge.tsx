"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSerialStore } from '@/lib/store';
import { useTelemetry } from '@/context/TelemetryContext';
import { useTerminalDashboard } from '@/context/TerminalDashboardContext';
import { ProcessedTelemetryData } from '@/context/TerminalDashboardContext';
import { GNSSDecompressor } from '@/lib/compression/GNSSDecompressor';
import { TemperatureDecompressor } from '@/lib/compression/TemperatureDecompressor';
import { GasSensorDecompressor } from '@/lib/compression/GasSensorDecompressor';
import { BatteryDecompressor } from '@/lib/compression/BatteryDecompressor';

// Create persistent decompressor instances (maintain state between packets)
const persistentDecompressors = {
  gnss: new GNSSDecompressor(),
  temperature: new TemperatureDecompressor(), 
  co: new GasSensorDecompressor('CO'),
  no2: new GasSensorDecompressor('NO2'),
  so2: new GasSensorDecompressor('SO2'),
  battery: new BatteryDecompressor()
};

// Function to parse NMEA $GPGGA sentence and extract coordinates
function parseNMEA(nmeaString: string): { latitude: number; longitude: number; altitude: number } {
  // Default values - Bandung, Indonesia
  const defaultData = { latitude: -6.890582045572037, longitude: 107.6110135724158, altitude: 100 };
  
  if (!nmeaString || !nmeaString.startsWith('$GPGGA')) {
    return defaultData;
  }
  
  try {
    const parts = nmeaString.split(',');
    if (parts.length < 15) return defaultData;
    
    // Parse latitude (format: DDMM.MMM,N/S)
    const latStr = parts[2];
    const latDir = parts[3];
    let latitude = 0;
    
    if (latStr && latDir && latStr.length >= 5) {
      // Extract degrees (first 2 digits) and minutes (remaining)
      const latDegrees = parseInt(latStr.substring(0, 2), 10);
      const latMinutes = parseFloat(latStr.substring(2));
      latitude = latDegrees + latMinutes / 60;
      if (latDir === 'S') latitude = -latitude;
    }
    
    // Parse longitude (format: DDDMM.MMM,E/W)
    const lonStr = parts[4];
    const lonDir = parts[5];
    let longitude = 0;
    
    if (lonStr && lonDir && lonStr.length >= 6) {
      // Extract degrees (first 3 digits) and minutes (remaining)
      const lonDegrees = parseInt(lonStr.substring(0, 3), 10);
      const lonMinutes = parseFloat(lonStr.substring(3));
      longitude = lonDegrees + lonMinutes / 60;
      if (lonDir === 'W') longitude = -longitude;
    }
    
    // Parse altitude (format: NNN.N,M)
    const altStr = parts[9];
    const altitude = altStr ? parseFloat(altStr) : 100;
    
    return { latitude, longitude, altitude };
  } catch (error) {
    console.error('Error parsing NMEA string:', error);
    return defaultData;
  }
}

// Function to process serial telemetry data to dashboard format
function processSerialTelemetryData(telemetryData: any, flightStartTime: number | null, isFlightActive: boolean): ProcessedTelemetryData {
  // Use pre-calculated latency from immediate reception timestamp, not current time
  const processingLatency = telemetryData.processingLatency;
  
  // Calculate flight time based on data reception
  let flightTime = 0;
  if (flightStartTime && isFlightActive) {
    flightTime = (Date.now() - flightStartTime) / 1000; // Convert to seconds
    console.log('🚁 Flight time calculation:', {
      flightStartTime: flightStartTime,
      currentTime: Date.now(),
      isFlightActive: isFlightActive,
      timeDifference: Date.now() - flightStartTime,
      flightTimeSeconds: flightTime
    });
  } else {
    // Ensure flight time is always 0 when not active
    flightTime = 0;
    console.log('🚁 Flight time NOT calculated (set to 0):', {
      flightStartTime: flightStartTime,
      isFlightActive: isFlightActive,
      reason: !flightStartTime ? 'No start time' : 'Flight not active'
    });
  }
  
  // Note: Latency debugging removed for cleaner console output
  
  // Debug: Log processed data with pre-calculated latency
  console.log('📥 PROCESSING DEBUG:', {
    currentProcessingTime: Date.now(),
    transmissionTime: telemetryData.transmissionTimestamp,
    preCalculatedLatencyMs: processingLatency,
    telemetryKeys: Object.keys(telemetryData),
    hasPreCalculatedLatency: 'processingLatency' in telemetryData,
    flightTime: flightTime,
    flightStartTime: flightStartTime,
    isFlightActive: isFlightActive,
    latencySource: 'PRE_CALCULATED_AT_RECEPTION'
  });
  
  // Check if data is compressed
  const isCompressed = !!(telemetryData.temp || telemetryData.co || 
                          telemetryData.no2 || telemetryData.so2 || telemetryData.batt);
  
  if (isCompressed) {
    // COMPRESSED DATA: Decompress it properly
    console.log('📝 Compressed data detected, decompressing...', {
      telemetryDataKeys: Object.keys(telemetryData),
      hasGnss: !!telemetryData.gnss,
      hasTemp: !!telemetryData.temp,
      hasCo: !!telemetryData.co,
      hasNo2: !!telemetryData.no2,
      hasSo2: !!telemetryData.so2,
      hasBatt: !!telemetryData.batt
    });
    
    const decompressionStartTime = performance.now();
    
    // Use persistent decompressors (maintain state between packets)
    const { gnss: gnssDecompressor, temperature: temperatureDecompressor, co: coDecompressor, 
            no2: no2Decompressor, so2: so2Decompressor, battery: batteryDecompressor } = persistentDecompressors;

    // Get last known values from global state or use defaults
    const lastKnownValues = (processSerialTelemetryData as any).lastKnownValues || {
      latitude: -6.890582045572037,
      longitude: 107.6110135724158,
      altitude: 100,
      temperature: 25,
      coLevel: 1.2,
      no2Level: 100,
      so2Level: 10,
      voltage: 3.7,
      current: 1.5,
      batteryPercentage: 75,
      batteryStatus: 'Discharging'
    };

    // Start with last known values
    let latitude = lastKnownValues.latitude;
    let longitude = lastKnownValues.longitude;
    let altitude = lastKnownValues.altitude;
    let temperature = lastKnownValues.temperature;
    let coLevel = lastKnownValues.coLevel;
    let no2Level = lastKnownValues.no2Level;
    let so2Level = lastKnownValues.so2Level;
    let voltage = lastKnownValues.voltage;
    let current = lastKnownValues.current;
    let batteryPercentage = lastKnownValues.batteryPercentage;
    let batteryStatus = lastKnownValues.batteryStatus;

    let decompressedCount = 0;
    let totalFields = 0;
    let emptyBufferCount = 0;

    try {
      // Decompress GNSS data
      if (telemetryData.gnss) {
        totalFields++;
        console.log('🛰️ Attempting GNSS decompression...', {
          base64Length: telemetryData.gnss.length,
          base64Preview: telemetryData.gnss.substring(0, 20) + '...'
        });
        try {
          const gnssBuffer = Buffer.from(telemetryData.gnss, 'base64');
          console.log('🛰️ GNSS buffer created:', { bufferLength: gnssBuffer.length });
          
          if (gnssBuffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known values
            emptyBufferCount++;
            console.log('📦 GNSS buffer is empty, keeping last known values:', { latitude, longitude, altitude });
          } else {
            const gnssData = gnssDecompressor.decompressData(gnssBuffer);
            if (gnssData) {
              latitude = gnssData.latitude;
              longitude = gnssData.longitude;
              altitude = gnssData.altitude;
              decompressedCount++;
              console.log('✅ GNSS decompressed successfully:', { latitude, longitude, altitude });
            } else {
              console.warn('⚠️ GNSS decompression returned null/undefined, keeping last known values');
            }
          }
        } catch (gnssError) {
          console.error('❌ GNSS decompression failed:', gnssError);
        }
      }

      // Decompress temperature data
      if (telemetryData.temp) {
        totalFields++;
        console.log('🌡️ Attempting temperature decompression...', {
          base64Length: telemetryData.temp.length,
          base64Preview: telemetryData.temp.substring(0, 20) + '...'
        });
        try {
          const tempBuffer = Buffer.from(telemetryData.temp, 'base64');
          console.log('🌡️ Temperature buffer created:', { bufferLength: tempBuffer.length });
          
          if (tempBuffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known value
            emptyBufferCount++;
            console.log('📦 Temperature buffer is empty, keeping last known value:', temperature);
          } else {
            const tempData = temperatureDecompressor.decompress(tempBuffer);
            if (tempData) {
              temperature = tempData.temperature;
              decompressedCount++;
              console.log('✅ Temperature decompressed successfully:', temperature);
            } else {
              console.warn('⚠️ Temperature decompression returned null/undefined, keeping last known value');
            }
          }
        } catch (tempError) {
          console.error('❌ Temperature decompression failed:', tempError);
        }
      }

      // Decompress CO data
      if (telemetryData.co) {
        totalFields++;
        console.log('💨 Attempting CO decompression...', {
          base64Length: telemetryData.co.length,
          base64Preview: telemetryData.co.substring(0, 20) + '...'
        });
        try {
          const coBuffer = Buffer.from(telemetryData.co, 'base64');
          console.log('💨 CO buffer created:', { bufferLength: coBuffer.length });
          
          if (coBuffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known value
            emptyBufferCount++;
            console.log('📦 CO buffer is empty, keeping last known value:', coLevel);
          } else {
            const coData = coDecompressor.decompress(coBuffer);
            if (coData) {
              coLevel = coData.sensorValue;
              decompressedCount++;
              console.log('✅ CO decompressed successfully:', coLevel);
            } else {
              console.warn('⚠️ CO decompression returned null/undefined, keeping last known value');
            }
          }
        } catch (coError) {
          console.error('❌ CO decompression failed:', coError);
        }
      }

      // Decompress NO2 data
      if (telemetryData.no2) {
        totalFields++;
        console.log('💨 Attempting NO2 decompression...', {
          base64Length: telemetryData.no2.length,
          base64Preview: telemetryData.no2.substring(0, 20) + '...'
        });
        try {
          const no2Buffer = Buffer.from(telemetryData.no2, 'base64');
          console.log('💨 NO2 buffer created:', { bufferLength: no2Buffer.length });
          
          if (no2Buffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known value
            emptyBufferCount++;
            console.log('📦 NO2 buffer is empty, keeping last known value:', no2Level);
          } else {
            const no2Data = no2Decompressor.decompress(no2Buffer);
            if (no2Data) {
              no2Level = no2Data.sensorValue;
              decompressedCount++;
              console.log('✅ NO2 decompressed successfully:', no2Level);
            } else {
              console.warn('⚠️ NO2 decompression returned null/undefined, keeping last known value');
            }
          }
        } catch (no2Error) {
          console.error('❌ NO2 decompression failed:', no2Error);
        }
      }

      // Decompress SO2 data
      if (telemetryData.so2) {
        totalFields++;
        console.log('💨 Attempting SO2 decompression...', {
          base64Length: telemetryData.so2.length,
          base64Preview: telemetryData.so2.substring(0, 20) + '...'
        });
        try {
          const so2Buffer = Buffer.from(telemetryData.so2, 'base64');
          console.log('💨 SO2 buffer created:', { bufferLength: so2Buffer.length });
          
          if (so2Buffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known value
            emptyBufferCount++;
            console.log('📦 SO2 buffer is empty, keeping last known value:', so2Level);
          } else {
            const so2Data = so2Decompressor.decompress(so2Buffer);
            if (so2Data) {
              so2Level = so2Data.sensorValue;
              decompressedCount++;
              console.log('✅ SO2 decompressed successfully:', so2Level);
            } else {
              console.warn('⚠️ SO2 decompression returned null/undefined, keeping last known value');
            }
          }
        } catch (so2Error) {
          console.error('❌ SO2 decompression failed:', so2Error);
        }
      }

      // Decompress battery data
      if (telemetryData.batt) {
        totalFields++;
        console.log('🔋 Attempting battery decompression...', {
          base64Length: telemetryData.batt.length,
          base64Preview: telemetryData.batt.substring(0, 20) + '...'
        });
        try {
          const battBuffer = Buffer.from(telemetryData.batt, 'base64');
          console.log('🔋 Battery buffer created:', { bufferLength: battBuffer.length });
          
          if (battBuffer.length === 0) {
            // Empty buffer - compression skipped this packet, keep last known values
            emptyBufferCount++;
            console.log('📦 Battery buffer is empty, keeping last known values:', { voltage, current, batteryPercentage, batteryStatus });
          } else {
            const battData = batteryDecompressor.decompressData(battBuffer);
            if (battData) {
              voltage = battData.voltage;
              current = battData.current;
              batteryPercentage = battData.percentage;
              batteryStatus = battData.status;
              decompressedCount++;
              console.log('✅ Battery decompressed successfully:', { voltage, current, batteryPercentage, batteryStatus });
              console.log('🔋 Battery percentage updated to:', batteryPercentage, 'from default', lastKnownValues.batteryPercentage);
            } else {
              console.warn('⚠️ Battery decompression returned null/undefined, keeping last known values');
              console.log('🔋 Battery percentage kept at default:', batteryPercentage);
            }
          }
        } catch (battError) {
          console.error('❌ Battery decompression failed:', battError);
        }
      }

      console.log('📊 Decompression Summary:', {
        totalFields,
        decompressedCount,
        emptyBufferCount,
        successRate: totalFields > 0 ? `${((decompressedCount / totalFields) * 100).toFixed(1)}%` : '0%',
        emptyBufferRate: totalFields > 0 ? `${((emptyBufferCount / totalFields) * 100).toFixed(1)}%` : '0%',
        usingLastKnownValues: decompressedCount === 0 && emptyBufferCount > 0
      });

      if (decompressedCount > 0) {
        console.log('✅ Serial compressed data successfully decompressed');
      } else if (emptyBufferCount > 0) {
        console.log('📦 Using last known values due to empty compression buffers');
      } else {
        console.warn('⚠️ No compressed data was successfully decompressed, using default values');
      }

      // Save current values as last known values for next time
      (processSerialTelemetryData as any).lastKnownValues = {
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
        batteryStatus
      };
      
    } catch (error) {
      console.error('❌ Error during serial data decompression:', error);
      // Continue with default values if decompression fails
    }

    const decompressionEndTime = performance.now();
    const decompressionTime = decompressionEndTime - decompressionStartTime;
    
    console.log('⏱️ SerialTelemetryBridge decompression time:', decompressionTime.toFixed(2) + 'ms');

    const finalResult = {
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
      timestamp: telemetryData.ts || Date.now(),
      flightTime: flightTime,
      dataSource: 'decompressed',
      processingLatency,
      compressionMetrics: telemetryData.compressionMetrics, // Pass through compression metrics if available
      decompressionTime // Actual decompression time measured
    };

    console.log('🔋 Final battery percentage being sent to dashboard:', finalResult.batteryPercentage);
    return finalResult;
  } else {
    // Process raw data
    const nmeaData = parseNMEA(telemetryData.gnss || '');
    
    // Debug: Log the received and parsed GNSS data
    console.log('🛰️ Received GNSS Data:', {
      originalNmea: telemetryData.gnss,
      parsedData: nmeaData
    });
    
    // Log pre-calculated latency if available
    if (processingLatency !== undefined) {
      console.log('⏱️ Using Pre-Calculated Latency:', processingLatency.toFixed(2), 'ms');
      
      // Validation for pre-calculated latency
      if (processingLatency < 0) {
        console.warn('⚠️ NEGATIVE PRE-CALCULATED LATENCY - This should not happen:', {
          preCalculatedLatency: processingLatency,
          transmissionTimestamp: telemetryData.transmissionTimestamp,
          latencySource: 'PRE_CALCULATED_AT_JSON_PARSING'
        });
      }
    } else {
      console.log('⏱️ No latency data available in telemetry');
    }
    
    return {
      latitude: nmeaData.latitude,
      longitude: nmeaData.longitude,
      altitude: nmeaData.altitude,
      temperature: telemetryData.temperature || 0,
      coLevel: telemetryData.coLevel || 0,
      no2Level: telemetryData.no2Level || 0,
      so2Level: telemetryData.so2Level || 0,
      voltage: telemetryData.voltage || 0,
      current: telemetryData.current || 0,
      batteryPercentage: telemetryData.batteryPercentage || 0,
      batteryStatus: telemetryData.batteryStatus || 'Unknown',
      timestamp: Date.now(),
      flightTime: flightTime,
      dataSource: 'raw',
      processingLatency
    };
  }
}

/**
 * SerialTelemetryBridge - Bridges serial data reception to dashboard visualization
 * 
 * This component listens to incoming serial data, parses telemetry JSON,
 * and forwards it to the TelemetryContext for dashboard visualization.
 */
export function SerialTelemetryBridge() {
  const { terminalContent, setTerminalContent } = useSerialStore();
  const { setTelemetryData } = useTelemetry();
  const { setProcessedData, setIsReceivingData, setLastUpdateTime, updateDataStats } = useTerminalDashboard();
  const [isProcessing, setIsProcessing] = useState(false);
  const lastProcessedContentRef = useRef<string>('');
  const telemetryBufferRef = useRef<string>('');
  const [isActiveReader, setIsActiveReader] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const readLoopActiveRef = useRef(false);
  
  // Flight time tracking based on data reception
  const flightStartTimeRef = useRef<number | null>(null);
  const lastDataReceivedTimeRef = useRef<number | null>(null);
  const [isFlightActive, setIsFlightActive] = useState(false);
  const DATA_TIMEOUT_MS = 5000; // 5 seconds without data = flight ended

  // Add a component mount test
  useEffect(() => {
    console.log('🚀 SerialTelemetryBridge MOUNTED - ENHANCED WITH ACTIVE READING');
    console.log('🚀 Component dependencies:', {
      hasTerminalContent: !!terminalContent,
      terminalContentLength: terminalContent?.length || 0,
      hasSetTelemetryData: !!setTelemetryData,
      hasSetProcessedData: !!setProcessedData,
      hasSetIsReceivingData: !!setIsReceivingData
    });
    return () => {
      console.log('🚀 SerialTelemetryBridge UNMOUNTED');
      // Clean up our reader if we have one
      if (readLoopActiveRef.current && readerRef.current) {
        console.log('🚀 SerialTelemetryBridge cleaning up active reader');
        readLoopActiveRef.current = false;
        try {
          readerRef.current.cancel().catch(() => {});
          readerRef.current.releaseLock();
        } catch (error) {
          console.log('Error cleaning up SerialTelemetryBridge reader:', error);
        }
        readerRef.current = null;
      }
    };
  }, []);

  // Process incoming serial data for telemetry
  useEffect(() => {
    console.log('🔍 SerialTelemetryBridge: checking terminalContent...', {
      hasContent: !!terminalContent,
      contentLength: terminalContent?.length || 0,
      isProcessing,
      lastProcessedLength: lastProcessedContentRef.current.length,
      terminalContentPreview: terminalContent ? terminalContent.substring(0, 200) + '...' : 'null',
      newContentLength: terminalContent ? terminalContent.length - lastProcessedContentRef.current.length : 0
    });
    
    if (!terminalContent || isProcessing) return;
    
    // Only process new content
    const newContent = terminalContent.slice(lastProcessedContentRef.current.length);
    if (!newContent) {
      console.log('📝 No new content to process');
      return;
    }
    
    console.log('📝 🔍 NEW CONTENT ANALYSIS:', {
      newContentLength: newContent.length,
      newContentPreview: newContent.substring(0, 200) + '...',
      containsOpenBrace: newContent.includes('{'),
      containsCloseBrace: newContent.includes('}'),
      openBraceCount: (newContent.match(/\{/g) || []).length,
      closeBraceCount: (newContent.match(/\}/g) || []).length
    });
    
    setIsProcessing(true);
    
    try {
      // Add new content to buffer
      const previousBufferLength = telemetryBufferRef.current.length;
      telemetryBufferRef.current += newContent;
      
      console.log('📝 🔍 BUFFER UPDATE:', {
        previousLength: previousBufferLength,
        newLength: telemetryBufferRef.current.length,
        addedLength: newContent.length,
        bufferSample: telemetryBufferRef.current.substring(Math.max(0, telemetryBufferRef.current.length - 200))
      });
      
      console.log('📝 Current buffer length:', telemetryBufferRef.current.length);
      
      // Extract complete JSON objects from buffer
      let processedAnyData = false;
      let remainingBuffer = telemetryBufferRef.current;
      
      console.log('📝 🔍 Starting JSON object detection, buffer length:', remainingBuffer.length);
      console.log('📝 🔍 Buffer preview (first 300 chars):', remainingBuffer.substring(0, 300) + '...');
      console.log('📝 🔍 Buffer preview (last 300 chars):', '...' + remainingBuffer.substring(Math.max(0, remainingBuffer.length - 300)));
      
      // Look for complete JSON objects by finding matching braces
      while (remainingBuffer.length > 0) {
        console.log('📝 🔍 Looking for JSON start in buffer of length:', remainingBuffer.length);
        const startIndex = remainingBuffer.indexOf('{');
        console.log('📝 🔍 JSON start found at index:', startIndex);
        
        if (startIndex === -1) {
          // No JSON start found, clear buffer up to this point
          console.log('📝 🔍 No JSON start found, clearing buffer of length:', remainingBuffer.length);
          console.log('📝 🔍 Buffer being cleared contained:', remainingBuffer.substring(0, 200) + '...');
          remainingBuffer = '';
          break;
        }
        
        // Find the matching closing brace
        let braceCount = 0;
        let endIndex = -1;
        
        console.log('📝 🔍 Starting brace matching from index:', startIndex);
        console.log('📝 🔍 Buffer segment to analyze:', remainingBuffer.substring(startIndex, startIndex + 200) + '...');
        
        for (let i = startIndex; i < remainingBuffer.length; i++) {
          const char = remainingBuffer[i];
          if (char === '{') {
            braceCount++;
            if (i < startIndex + 50) console.log(`📝 🔍 Found { at index ${i}, braceCount: ${braceCount}`);
          } else if (char === '}') {
            braceCount--;
            if (i < startIndex + 50) console.log(`📝 🔍 Found } at index ${i}, braceCount: ${braceCount}`);
            if (braceCount === 0) {
              endIndex = i;
              console.log('📝 ✅ Found matching closing brace at index:', endIndex, 'JSON length:', endIndex - startIndex + 1);
              break;
            }
          }
        }
        
        console.log('📝 🔍 Brace matching result:', {
          finalBraceCount: braceCount,
          endIndex: endIndex,
          bufferLength: remainingBuffer.length,
          searchedFrom: startIndex,
          searchedTo: remainingBuffer.length - 1
        });
        
        if (endIndex === -1) {
          // No complete JSON object found, keep remaining buffer
          console.log('📝 🔍 No complete JSON object found, keeping remaining buffer');
          break;
        }
        
        // Extract the complete JSON object
        const jsonString = remainingBuffer.substring(startIndex, endIndex + 1);
        console.log('📝 ✅ Found complete JSON object:', jsonString.length, 'characters');
        
        // More aggressive JSON cleaning for telemetry data
        let cleanedJsonString = jsonString;
        
        // Remove all control characters and problematic characters
        cleanedJsonString = cleanedJsonString
          .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
          .replace(/\r/g, '') // Remove carriage returns
          .replace(/\n/g, '') // Remove line feeds
          .replace(/\t/g, '') // Remove tabs
          .replace(/\\\\/g, '\\') // Fix double backslashes
          .trim();
        
        // Try to fix common JSON issues in NMEA strings
        cleanedJsonString = cleanedJsonString.replace(/"([^"]*\*[^"]*)"/, (match, nmeaString) => {
          // Clean the NMEA string inside quotes
          const cleanedNmea = nmeaString.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
          return `"${cleanedNmea}"`;
        });
        
        console.log('📝 🧹 Cleaned JSON string:', cleanedJsonString.substring(0, 100) + '...');
        
        // Try to parse the JSON
        try {
          // Capture reception timestamp IMMEDIATELY after successful JSON parsing, before any other processing
          const dataReceptionTimestamp = Date.now();
          
          const telemetryData = JSON.parse(cleanedJsonString);
          console.log('📝 ✅ JSON parsed successfully:', Object.keys(telemetryData));
          
          // Calculate latency immediately with the earliest possible reception time
          const transmissionTime = telemetryData.transmissionTimestamp;
          const actualLatency = transmissionTime ? dataReceptionTimestamp - transmissionTime : undefined;
          
          // Add the calculated latency to telemetry data
          if (actualLatency !== undefined) {
            telemetryData.processingLatency = actualLatency;
            console.log('⏱️ IMMEDIATE LATENCY CALCULATION:', {
              transmissionTime: transmissionTime,
              receptionTime: dataReceptionTimestamp,
              latencyMs: actualLatency,
              latencyCategory: actualLatency < 50 ? 'EXCELLENT' : actualLatency < 100 ? 'GOOD' : actualLatency < 200 ? 'FAIR' : 'HIGH'
            });
          }
          
          // Debug: Check if transmissionTimestamp survived JSON parsing
          if (telemetryData.transmissionTimestamp) {
            console.log('🔍 JSON PARSING DEBUG:', {
              transmissionTimestamp: telemetryData.transmissionTimestamp,
              type: typeof telemetryData.transmissionTimestamp,
              isNumber: typeof telemetryData.transmissionTimestamp === 'number',
              value: telemetryData.transmissionTimestamp,
              receptionTimestamp: dataReceptionTimestamp,
              calculatedLatency: actualLatency
            });
          }
          
          // Validate that it's telemetry data (has expected fields)
          const isValid = isTelemetryData(telemetryData);
          console.log('📝 🔍 Validation result:', isValid, 'for data:', Object.keys(telemetryData));
          
          if (isValid) {
            console.log('📡 ✅ Received telemetry data via serial:', telemetryData);
            
            // Track flight time based on data reception
            const currentTime = Date.now();
            const timeSinceLastData = lastDataReceivedTimeRef.current ? currentTime - lastDataReceivedTimeRef.current : 0;
            
            // Check if this is the first data or data after a timeout
            let currentFlightActive = isFlightActive;
            if (!flightStartTimeRef.current || timeSinceLastData > DATA_TIMEOUT_MS) {
              // Start new flight session
              flightStartTimeRef.current = currentTime;
              setIsFlightActive(true);
              currentFlightActive = true; // Use immediate value instead of waiting for state update
              console.log('🚁 Flight time started/restarted at:', new Date(currentTime).toLocaleTimeString());
            }
            
            // Update last data received time
            lastDataReceivedTimeRef.current = currentTime;
            
            // Forward to TelemetryContext for DataProcessor
            setTelemetryData(telemetryData);
            console.log('📡 ✅ Data forwarded to TelemetryContext');
            
            // ALSO directly process and forward to dashboard (bypass DataProcessor issues)
            const processedData = processSerialTelemetryData(telemetryData, flightStartTimeRef.current, currentFlightActive);
            console.log('🔄 PROCESSING RESULT:', {
              processedData: processedData,
              hasLatitude: processedData.latitude !== undefined,
              hasTemperature: processedData.temperature !== undefined,
              hasVoltage: processedData.voltage !== undefined,
              processingLatency: processedData.processingLatency,
              flightTime: processedData.flightTime,
              flightStartTime: flightStartTimeRef.current,
              currentFlightActive: currentFlightActive,
              rawFlightTime: flightStartTimeRef.current ? (Date.now() - flightStartTimeRef.current) / 1000 : 0
            });
            
            setIsReceivingData(true);
            console.log('🔋 SerialTelemetryBridge: Sending battery percentage to dashboard:', processedData.batteryPercentage);
            setProcessedData(processedData);
            setLastUpdateTime(Date.now());
            
            // Fix compression ratio calculation
            const isCompressed = processedData.dataSource === 'decompressed';
            console.log('📊 Updating data stats - Processing time: 1ms, Is compressed:', isCompressed, 'Latency:', processedData.processingLatency);
            updateDataStats(1, isCompressed, processedData.processingLatency); // Include latency in stats
            
            console.log('📡 ✅ Data DIRECTLY forwarded to Dashboard:', {
              latitude: processedData.latitude,
              longitude: processedData.longitude,
              temperature: processedData.temperature,
              voltage: processedData.voltage,
              dataSource: processedData.dataSource,
              processingLatency: processedData.processingLatency,
              flightTime: processedData.flightTime
            });
            
            setTimeout(() => setIsReceivingData(false), 100); // Reset receiving flag after brief delay
            processedAnyData = true;
          } else {
            console.log('📝 ❌ Not telemetry data (failed validation):', Object.keys(telemetryData));
          }
        } catch (parseError) {
          console.log('📝 ❌ JSON parsing failed for object:', jsonString.substring(0, 50) + '...');
          console.log('📝 ❌ Parse error:', parseError);
        }
        
        // Move to the next part of the buffer
        const beforeUpdate = remainingBuffer.length;
        remainingBuffer = remainingBuffer.substring(endIndex + 1);
        console.log('📝 🔍 BUFFER ADVANCEMENT:', {
          beforeLength: beforeUpdate,
          afterLength: remainingBuffer.length,
          removedLength: beforeUpdate - remainingBuffer.length,
          nextBufferPreview: remainingBuffer.substring(0, 100) + '...'
        });
      }
      
      // Update buffer with remaining content
      console.log('📝 🔍 FINAL BUFFER UPDATE:', {
        oldBufferLength: telemetryBufferRef.current.length,
        newBufferLength: remainingBuffer.length,
        finalBufferPreview: remainingBuffer.substring(0, 200) + '...',
        processedAnyData: processedAnyData
      });
      
      // Safety: Prevent infinite buffer growth if we're not processing anything
      if (!processedAnyData && telemetryBufferRef.current.length > 50000) {
        console.warn('📝 ⚠️ Buffer too large without processing data, truncating');
        console.log('📝 ⚠️ Buffer content before truncation:', telemetryBufferRef.current.substring(0, 500) + '...');
        telemetryBufferRef.current = remainingBuffer.substring(Math.max(0, remainingBuffer.length - 10000));
      } else {
        telemetryBufferRef.current = remainingBuffer;
      }
      
      if (processedAnyData) {
        console.log('✅ SerialTelemetryBridge: Successfully processed telemetry data');
      }
      
      // Update last processed content
      lastProcessedContentRef.current = terminalContent;
      
    } catch (error) {
      console.error('❌ Error processing serial telemetry data:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [terminalContent, isProcessing, setTelemetryData, setProcessedData, setIsReceivingData, setLastUpdateTime, updateDataStats, isFlightActive]);
  
  // Debug: Track terminalContent changes separately 
  useEffect(() => {
    console.log('📝 🔍 TERMINAL CONTENT CHANGED:', {
      length: terminalContent?.length || 0,
      hasContent: !!terminalContent,
      lastChars: terminalContent ? terminalContent.slice(-100) : 'null'
    });
  }, [terminalContent]);

  // Function to start active reading from the serial port
  const startActiveReading = useCallback(async (port: any) => {
    if (!port?.readable || port.readable.locked) {
      console.log('📡 SerialTelemetryBridge: Cannot start reading - port not available or locked');
      return;
    }

    try {
      console.log('📡 SerialTelemetryBridge: Starting active serial port reading');
      setIsActiveReader(true);
      readLoopActiveRef.current = true;

      while (port.readable && readLoopActiveRef.current) {
        let reader;
        try {
          reader = port.readable.getReader();
          readerRef.current = reader;
        } catch (error: any) {
          if (error.message?.includes('locked')) {
            console.log('📡 SerialTelemetryBridge: Port became locked, stopping our reader');
            break;
          }
          throw error;
        }

        try {
          console.log('📡 SerialTelemetryBridge: Active read loop started');
          while (readLoopActiveRef.current) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('📡 SerialTelemetryBridge: Reader signaled "done"');
              break;
            }
            if (value) {
              // Decode and add to terminal content
              const decoder = new TextDecoder('utf-8', { fatal: false });
              const text = decoder.decode(value, { stream: true });
              
              console.log('📡 SerialTelemetryBridge: Received data:', text.length, 'chars');
              setTerminalContent(prev => prev + text);
              
              // Update last data time
              lastDataTimeRef.current = Date.now();
            }
          }
        } catch (error: any) {
          console.error('📡 SerialTelemetryBridge: Error in read loop:', error);
          if (readLoopActiveRef.current) {
            // Only log as error if we're still supposed to be reading
            console.error('📡 SerialTelemetryBridge: Active reading failed:', error.message);
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (e) {
              console.warn('📡 SerialTelemetryBridge: Error releasing reader lock:', e);
            }
            readerRef.current = null;
          }
        }

        if (!readLoopActiveRef.current) {
          console.log('📡 SerialTelemetryBridge: Read loop terminated');
          break;
        }
        
        // Short delay before retrying
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error('📡 SerialTelemetryBridge: Fatal error in active reading:', error);
    } finally {
      setIsActiveReader(false);
      readLoopActiveRef.current = false;
      console.log('📡 SerialTelemetryBridge: Active reading stopped');
    }
  }, [setTerminalContent]);

  // Recovery mechanism: Check if we've stopped receiving data and attempt recovery
  const lastDataTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    if (terminalContent && terminalContent.length > 0) {
      lastDataTimeRef.current = Date.now();
    }
  }, [terminalContent]);

  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      const timeSinceLastData = Date.now() - lastDataTimeRef.current;
      const { useSerialStore, getSessionState } = require('@/lib/store');
      const { isConnected } = useSerialStore.getState();
      const sessionState = getSessionState();
      
      // If we haven't received data in 3 seconds but should be connected, check if we need to start reading
      if (timeSinceLastData > 3000 && isConnected && sessionState.port) {
        const portLocked = !!sessionState.port?.readable?.locked;
        
        console.log('🔍 SerialTelemetryBridge: Data flow check:', {
          timeSinceLastData: timeSinceLastData,
          isConnected: isConnected,
          hasPort: !!sessionState.port,
          portReadable: !!sessionState.port?.readable,
          portLocked: portLocked,
          terminalContentLength: terminalContent?.length || 0,
          isActiveReader: isActiveReader
        });
        
        // If port is not locked and we're not already reading, start reading
        if (!portLocked && !isActiveReader && sessionState.port?.readable) {
          console.log('📡 SerialTelemetryBridge: No active reader detected, starting our own reader');
          startActiveReading(sessionState.port);
        }
      }
    }, 3000);

    return () => clearInterval(recoveryInterval);
  }, [terminalContent, isActiveReader, startActiveReading]);

  // Flight time timeout monitoring
  useEffect(() => {
    const flightTimeoutInterval = setInterval(() => {
      if (isFlightActive && lastDataReceivedTimeRef.current) {
        const timeSinceLastData = Date.now() - lastDataReceivedTimeRef.current;
        
        if (timeSinceLastData > DATA_TIMEOUT_MS) {
          console.log('🚁 Flight time stopped - no data for', DATA_TIMEOUT_MS / 1000, 'seconds at', new Date().toLocaleTimeString());
          setIsFlightActive(false);
          
          // Send reset flight time to dashboard
          const resetData = {
            latitude: -6.890582045572037,
            longitude: 107.6110135724158,
            altitude: 100,
            temperature: 25,
            coLevel: 1.2,
            no2Level: 100,
            so2Level: 10,
            voltage: 3.7,
            current: 1.5,
            batteryPercentage: 75,
            batteryStatus: 'Unknown',
            timestamp: Date.now(),
            flightTime: 0, // Reset flight time to 0
            dataSource: 'timeout' as any
          };
          
          console.log('🚁 Sending reset flight time to dashboard');
          setProcessedData(resetData);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(flightTimeoutInterval);
  }, [isFlightActive, DATA_TIMEOUT_MS, setProcessedData]);

  // Function to validate if data is telemetry data
  const isTelemetryData = (data: any): boolean => {
    console.log('📝 🔍 VALIDATION STARTED for data:', data);
    
    if (!data || typeof data !== 'object') {
      console.log('📝 ❌ Validation failed: not an object', typeof data, data);
      return false;
    }
    
    console.log('📝 🔍 Data keys:', Object.keys(data));
    console.log('📝 🔍 GNSS field:', data.gnss);
    
    // Check for telemetry data signatures
    // Raw data has: gnss, temperature, voltage, transmissionTimestamp
    // Compressed data has: gnss (base64), temp, batt, ts
    const hasGnss = data.gnss && typeof data.gnss === 'string';
    const isRawNMEA = hasGnss && data.gnss.startsWith('$GPGGA');
    const hasRawFields = data.temperature !== undefined || data.voltage !== undefined || data.transmissionTimestamp !== undefined;
    const hasCompressedFields = data.temp !== undefined || data.batt !== undefined || data.ts !== undefined;
    
    const hasRawSignature = hasGnss && isRawNMEA && hasRawFields;
    const hasCompressedSignature = hasGnss && !isRawNMEA && hasCompressedFields;
    
    console.log('📝 🔍 DETAILED Validation check:', {
      hasGnss: hasGnss,
      gnssValue: data.gnss?.substring(0, 50) + '...',
      isRawNMEA: isRawNMEA,
      hasRawFields: hasRawFields,
      hasCompressedFields: hasCompressedFields,
      hasRawSignature: hasRawSignature,
      hasCompressedSignature: hasCompressedSignature,
      allKeys: Object.keys(data),
      dataValues: {
        temperature: data.temperature,
        voltage: data.voltage,
        transmissionTimestamp: data.transmissionTimestamp,
        temp: data.temp,
        batt: data.batt,
        ts: data.ts
      }
    });
    
    const result = hasRawSignature || hasCompressedSignature;
    console.log('📝 ✅ Final validation result:', result);
    return result;
  };

  // Reset buffer when component unmounts
  useEffect(() => {
    return () => {
      telemetryBufferRef.current = '';
      lastProcessedContentRef.current = '';
    };
  }, []);

  // This component doesn't render anything - it's just for data processing
  return null;
} 