"use client";

import { useState, useRef, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { EnhancedTerminal } from "@/components/enhanced-terminal"
import { useTelemetry } from "@/context/TelemetryContext"
import { DataProcessor } from "@/components/DataProcessor"
import { SerialTelemetryBridge } from "@/components/SerialTelemetryBridge"
import { Button } from "@/components/ui/button"
import { Play, Square, Send, RotateCcw, Download } from "lucide-react"
import { useSerialStore } from "@/lib/store"
import {
  FullPageContent,
  SidebarProvider,
} from "@/components/ui/sidebar"

// Import decompression classes
import { BatteryDecompressor } from "@/lib/compression/BatteryDecompressor"
import { GNSSDecompressor } from "@/lib/compression/GNSSDecompressor"
import { TemperatureDecompressor } from "@/lib/compression/TemperatureDecompressor"
import { GasSensorDecompressor } from "@/lib/compression/GasSensorDecompressor"

// Import shared context
import { useProcessedData, ProcessedTelemetryData } from "@/context/ProcessedDataContext"

export default function Page() {
  const { isSimulating, startSimulation, stopSimulation, telemetryData } = useTelemetry();
  const { isConnected: terminalConnected, port } = useSerialStore();
  
  // Shared context for processed data
  const { updateProcessedData, setReceivingStatus } = useProcessedData();
  
  // Manual transmission state (for "Send Once" button)
  const [lastTransmittedTimestamp, setLastTransmittedTimestamp] = useState(0);

  // Data Reading State
  const [isReading, setIsReading] = useState(false);
  const [lastReceivedTimestamp, setLastReceivedTimestamp] = useState<number | null>(null);
  const [rawIncomingData, setRawIncomingData] = useState<string>('');
  const [recentDataHistory, setRecentDataHistory] = useState<Array<{timestamp: number, data: string}>>([]);
  const [readingError, setReadingError] = useState<string | null>(null);

  // Background Processing State (not shown in UI)
  const [processedData, setProcessedData] = useState<ProcessedTelemetryData | null>(null);

  // Reader reference for cleanup
  const dataReaderRef = useRef<ReadableStreamDefaultReader | null>(null);
  const isReadingActiveRef = useRef(false);

  // Background Data Processing Functions
  const detectDataFormat = (data: any): 'compressed' | 'uncompressed' => {
    // Check for compressed field names
    const compressedFields = ['batt', 'gnss', 'temp', 'co', 'no2', 'so2', 'ts', 'sig', 'time'];
    const hasCompressedFields = compressedFields.some(field => data.hasOwnProperty(field));
    
    return hasCompressedFields ? 'compressed' : 'uncompressed';
  };

  const decompressBatteryData = async (compressedData: string): Promise<any> => {
    try {
      const decompressor = new BatteryDecompressor();
      // Convert base64 string to Buffer
      const buffer = Buffer.from(compressedData, 'base64');
      return decompressor.decompress(buffer);
    } catch (error) {
      console.error('Battery decompression failed:', error);
      return null;
    }
  };

  const decompressGNSSData = async (compressedData: string): Promise<any> => {
    try {
      const decompressor = new GNSSDecompressor();
      // Convert base64 string to Buffer
      const buffer = Buffer.from(compressedData, 'base64');
      return decompressor.decompress(buffer);
    } catch (error) {
      console.error('GNSS decompression failed:', error);
      return null;
    }
  };

  const decompressTemperatureData = async (compressedData: string): Promise<any> => {
    try {
      const decompressor = new TemperatureDecompressor();
      // Convert base64 string to Buffer
      const buffer = Buffer.from(compressedData, 'base64');
      return decompressor.decompress(buffer);
    } catch (error) {
      console.error('Temperature decompression failed:', error);
      return null;
    }
  };

  const decompressGasData = async (compressedData: string, sensorType: string): Promise<any> => {
    try {
      const decompressor = new GasSensorDecompressor(sensorType as any);
      // Convert base64 string to Buffer
      const buffer = Buffer.from(compressedData, 'base64');
      return decompressor.decompress(buffer);
    } catch (error) {
      console.error('Gas sensor decompression failed:', error);
      return null;
    }
  };

  // Background processing function
  const processIncomingData = async (rawData: any): Promise<ProcessedTelemetryData> => {
    const startTime = Date.now();
    const dataFormat = detectDataFormat(rawData);
    
    let processed: ProcessedTelemetryData = {
      wasCompressed: dataFormat === 'compressed',
      processingTime: 0
    };

    try {
      if (dataFormat === 'compressed') {
        // Handle compressed data - decompress each field as needed
        
        // Battery data
        if (rawData.batt) {
          const batteryData = await decompressBatteryData(rawData.batt);
          if (batteryData) {
            processed.voltage = batteryData.voltage;
            processed.current = batteryData.current;
            processed.batteryPercentage = batteryData.percentage;
            processed.batteryStatus = batteryData.status;
          }
        }

        // GNSS data
        if (rawData.gnss) {
          const gnssData = await decompressGNSSData(rawData.gnss);
          if (gnssData) {
            processed.latitude = gnssData.latitude;
            processed.longitude = gnssData.longitude;
            processed.altitude = gnssData.altitude;
            processed.hdop = gnssData.hdop;
            processed.satellites = gnssData.satellites;
          }
        }

        // Temperature data
        if (rawData.temp) {
          const tempData = await decompressTemperatureData(rawData.temp);
          if (tempData) {
            processed.temperature = tempData.temperature;
          }
        }

        // Gas sensor data
        if (rawData.co) {
          const gasData = await decompressGasData(rawData.co, 'CO');
          if (gasData) processed.coLevel = gasData.sensorValue;
        }
        if (rawData.no2) {
          const gasData = await decompressGasData(rawData.no2, 'NO2');
          if (gasData) processed.no2Level = gasData.sensorValue;
        }
        if (rawData.so2) {
          const gasData = await decompressGasData(rawData.so2, 'SO2');
          if (gasData) processed.so2Level = gasData.sensorValue;
        }

        // System data (compressed field names)
        processed.timestamp = rawData.ts || Date.now();
        processed.signalStrength = rawData.sig;
        processed.flightTime = rawData.time;

      } else {
        // Handle uncompressed data - direct mapping
        processed.latitude = rawData.latitude;
        processed.longitude = rawData.longitude;
        processed.altitude = rawData.altitude;
        processed.temperature = rawData.temperature;
        processed.coLevel = rawData.coLevel;
        processed.no2Level = rawData.no2Level;
        processed.so2Level = rawData.so2Level;
        processed.voltage = rawData.voltage;
        processed.current = rawData.current;
        processed.batteryPercentage = rawData.batteryPercentage;
        processed.batteryStatus = rawData.batteryStatus;
        processed.timestamp = rawData.timestamp || Date.now();
        processed.signalStrength = rawData.signalStrength;
        processed.flightTime = rawData.flightTime;
      }

    } catch (error) {
      console.error('Data processing error:', error);
    }

    processed.processingTime = Date.now() - startTime;
    return processed;
  };

  // Data Reading Function
  const startDataReading = async () => {
    if (!port || !port.readable) {
      setReadingError('Serial port not available or not readable');
      return;
    }

    if (isReadingActiveRef.current) {
      console.log('Data reading already active');
      return;
    }

    try {
      setIsReading(true);
      setReadingError(null);
      isReadingActiveRef.current = true;
      
      // Update shared context
      setReceivingStatus(true);

      // Get reader from port
      const reader = port.readable.getReader();
      dataReaderRef.current = reader;

      console.log('🔍 Starting data reading from serial port...');

      // Continuous reading loop
      const decoder = new TextDecoder();
      let buffer = '';

      while (isReadingActiveRef.current) {
        try {
          const { value, done } = await reader.read();
          
          if (done) {
            console.log('📡 Serial port reading stream ended');
            break;
          }

          // Decode incoming data
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete JSON objects (assuming data ends with newline)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                // Try to parse as JSON
                const jsonData = JSON.parse(line.trim());
                const timestamp = Date.now();
                
                // Update state with received data
                setRawIncomingData(JSON.stringify(jsonData, null, 2));
                setLastReceivedTimestamp(timestamp);
                
                // Add to history (keep last 10 entries)
                setRecentDataHistory(prev => {
                  const newEntry = { timestamp, data: line.trim() };
                  const updated = [newEntry, ...prev].slice(0, 10);
                  return updated;
                });
                
                console.log('📥 Received data:', jsonData);
                
                // Background processing - process the data silently
                processIncomingData(jsonData).then(processed => {
                  setProcessedData(processed);
                  // Feed processed data to shared context
                  updateProcessedData(processed);
                  console.log('🔄 Data processed and sent to shared context:', processed);
                }).catch(error => {
                  console.error('❌ Background processing failed:', error);
                });
                
              } catch (parseError) {
                console.log('⚠️ Received non-JSON data:', line.trim());
                // Still store raw data even if not JSON
                setRawIncomingData(line.trim());
                setLastReceivedTimestamp(Date.now());
              }
            }
          }
          
        } catch (readError: any) {
          if (readError.name === 'AbortError') {
            console.log('📡 Reading was cancelled');
            break;
          }
          console.error('❌ Error reading data:', readError);
          setReadingError(`Reading error: ${readError.message}`);
          break;
        }
      }

    } catch (error: any) {
      console.error('❌ Failed to start data reading:', error);
      setReadingError(`Failed to start reading: ${error.message}`);
    } finally {
      // Cleanup
      if (dataReaderRef.current) {
        try {
          await dataReaderRef.current.cancel();
          dataReaderRef.current.releaseLock();
        } catch (e) {
          console.warn('Error during reader cleanup:', e);
        }
        dataReaderRef.current = null;
      }
      
      isReadingActiveRef.current = false;
      setIsReading(false);
      // Update shared context
      setReceivingStatus(false);
      console.log('🔍 Data reading stopped');
    }
  };

  // Stop Data Reading
  const stopDataReading = () => {
    if (isReadingActiveRef.current) {
      isReadingActiveRef.current = false;
      
      if (dataReaderRef.current) {
        dataReaderRef.current.cancel().catch(console.warn);
      }
      
      setIsReading(false);
      // Update shared context
      setReceivingStatus(false);
      console.log('🛑 Data reading stopped by user');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isReadingActiveRef.current) {
        stopDataReading();
      }
    };
  }, []);

  // Manual send telemetry data function using the same approach as EnhancedTerminal
  const sendTelemetryData = async () => {
    console.log('=== TELEMETRY SEND DEBUG ===');
    console.log('terminalConnected:', terminalConnected);
    console.log('terminalConnected:', terminalConnected);
    console.log('telemetryData:', telemetryData);
    
    if (!telemetryData) {
      alert('No telemetry data available. Please start simulation first.');
      return;
    }
    
    // Use the SAME approach as EnhancedTerminal - get port from store directly
    const port = useSerialStore.getState().port;
    console.log('Port from store:', port);
    console.log('Port writable:', !!port?.writable);
    
    if (!port || !port.writable) {
      alert('Serial port not available or not writable. Please connect first.');
      return;
    }
    
    try {
      // Test JSON serialization first
      console.log('Testing JSON serialization...');
      const jsonData = JSON.stringify(telemetryData, null, 2) + '\n';
      console.log('JSON data size:', jsonData.length, 'bytes');
      console.log('JSON preview:', jsonData.substring(0, 200) + '...');
      
      // Use EXACT same approach as EnhancedTerminal sendFullCommand
      console.log('Getting writer from port...');
      const writer = port.writable.getWriter();
      
      try {
        // Convert to bytes and send (same as EnhancedTerminal)
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonData);
        await writer.write(data);
        
        console.log('✅ SUCCESS: Telemetry data sent successfully!');
        alert('Telemetry data sent successfully!');
        
      } finally {
        // Always release the writer (same as EnhancedTerminal)
        try {
          writer.releaseLock();
        } catch (e) {
          console.warn('Error releasing writer lock:', e);
        }
      }
      
    } catch (error: any) {
      console.error('❌ FAILED to send telemetry:', error);
      console.error('Error details:', {
        name: error?.name || 'Unknown',
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace'
      });
      alert(`Failed to send telemetry data: ${error?.message || 'Unknown error'}`);
    }
  };

  // Note: Auto-transmission is now handled automatically by TelemetryContext
  // when simulation starts. No separate controls needed.

  return (
    <>
      {/* Background components - run automatically */}
      <DataProcessor />
      <SerialTelemetryBridge />
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
          backgroundColor: "#0F172A",
          display: "flex",
          flexDirection: "column",
          width: "100%"
        }}>
          <div className="flex flex-1 flex-col space-y-4">
            <div className="flex-1">
              <EnhancedTerminal />
            </div>
            
            {/* Data Reading Panel */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Data Reader</h3>
              
              <div className="space-y-4">
                {/* Reader Controls */}
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={isReading ? stopDataReading : startDataReading}
                    disabled={!terminalConnected || !port}
                    variant={isReading ? "destructive" : "default"}
                    className="min-w-32"
                  >
                    {isReading ? (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Stop Reading
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Start Reading
                      </>
                    )}
                  </Button>
                  
                  <div className="text-sm text-slate-400">
                    Reader Status: <span className={isReading ? "text-green-400" : "text-slate-400"}>
                      {isReading ? "Reading" : "Stopped"}
                    </span>
                  </div>
                  
                  {lastReceivedTimestamp && (
                    <div className="text-sm text-slate-400">
                      Last Received: <span className="text-blue-400">
                        {new Date(lastReceivedTimestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {readingError && (
                  <div className="p-3 bg-red-900/20 border border-red-700 rounded-md">
                    <div className="text-sm text-red-300">
                      ❌ <strong>Error:</strong> {readingError}
                    </div>
                  </div>
                )}

                {/* Raw Data Display */}
                {rawIncomingData && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-300">Latest Raw Data:</h4>
                    <div className="bg-slate-900 rounded-md p-3 max-h-40 overflow-auto">
                      <pre className="text-xs text-green-400 font-mono">
                        {rawIncomingData}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Data History */}
                {recentDataHistory.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-300">Recent Data History:</h4>
                    <div className="bg-slate-900 rounded-md p-3 max-h-60 overflow-auto">
                      {recentDataHistory.map((entry, index) => (
                        <div key={index} className="mb-2 pb-2 border-b border-slate-700 last:border-b-0 last:mb-0 last:pb-0">
                          <div className="text-xs text-slate-400 mb-1">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>
                          <pre className="text-xs text-blue-300 font-mono">
                            {entry.data}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Control Panel - simulation and serial transmission */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Control Panel</h3>

              <div className="flex items-center space-x-4 flex-wrap gap-4">
                {/* Simulation Control */}
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={isSimulating ? stopSimulation : startSimulation}
                    disabled={!isSimulating && (!terminalConnected || !port || (!port.readable && !port.writable))}
                    variant={isSimulating ? "destructive" : "default"}
                    className="min-w-32"
                  >
                    {isSimulating ? (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Stop Simulation
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Simulation
                      </>
                    )}
                  </Button>
                  
                  <div className="text-sm text-slate-400">
                    Simulation: <span className={isSimulating ? "text-green-400" : "text-slate-400"}>
                      {isSimulating ? "Running" : "Stopped"}
                    </span>
                  </div>
                </div>

                {/* Serial Transmission */}
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={sendTelemetryData}
                    disabled={!terminalConnected || !isSimulating}
                    variant="outline"
                    className="min-w-32"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Once
                  </Button>
                  
                  <div className="text-sm text-slate-400">
                    Serial: <span className={terminalConnected ? "text-green-400" : "text-slate-400"}>
                      {terminalConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    Auto-TX: <span className={isSimulating ? "text-green-400" : "text-slate-400"}>
                      {isSimulating ? "Running" : "Stopped"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </FullPageContent>
    </>
  )
}
