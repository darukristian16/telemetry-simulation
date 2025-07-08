"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTelemetry } from '@/context/TelemetryContext';
import { useTerminalDashboard } from '@/context/TerminalDashboardContext';
import { useSerialStore } from '@/lib/store';

export function DebugPanel() {
  const { telemetryData, isSimulating, compressionSettings } = useTelemetry();
  const { processedData, isReceivingData, dataStats } = useTerminalDashboard();
  const { terminalContent, isConnected } = useSerialStore();

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">🐛 Debug Panel</CardTitle>
        <CardDescription className="text-gray-400">
          Real-time telemetry data flow debugging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              Serial: {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div>
            <Badge variant={isSimulating ? "default" : "secondary"}>
              Simulation: {isSimulating ? "Running" : "Stopped"}
            </Badge>
          </div>
        </div>

        {/* Telemetry Data Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Telemetry Generation:</h4>
          <div className="text-xs text-gray-400">
            <div>Has Data: {!!telemetryData ? "✅" : "❌"}</div>
            <div>Compression: {compressionSettings.enabled ? "Enabled" : "Disabled"}</div>
            {telemetryData && (
              <div className="mt-2 p-2 bg-gray-800 rounded">
                <div>TransmissionTimestamp: {telemetryData.transmissionTimestamp || telemetryData.ts || "None"}</div>
                <div>GNSS: {telemetryData.gnss ? 
                  (telemetryData.gnss.startsWith('$GPGGA') ? "Raw NMEA" : "Compressed") : "None"}</div>
                <div>Temperature: {telemetryData.temperature || telemetryData.temp ? "✅" : "❌"}</div>
                <div>Battery: {telemetryData.voltage || telemetryData.batt ? "✅" : "❌"}</div>
              </div>
            )}
          </div>
        </div>

        {/* Serial Content Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Serial Reception:</h4>
          <div className="text-xs text-gray-400">
            <div>Terminal Content Length: {terminalContent?.length || 0} chars</div>
            <div>Last 100 chars: {terminalContent ? 
              `"${terminalContent.slice(-100)}"` : "Empty"}</div>
          </div>
        </div>

        {/* Dashboard Processing Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Dashboard Processing:</h4>
          <div className="text-xs text-gray-400">
            <div>Is Receiving: {isReceivingData ? "✅" : "❌"}</div>
            <div>Has Processed Data: {!!processedData ? "✅" : "❌"}</div>
            <div>Data Source: {processedData?.dataSource || "None"}</div>
            <div>Processing Latency: {processedData?.processingLatency ? 
              `${processedData.processingLatency.toFixed(2)}ms` : "N/A"}</div>
            <div>Total Packets: {dataStats.totalPacketsReceived}</div>
            <div>Raw Packets: {dataStats.rawPackets}</div>
            <div>Compressed Packets: {dataStats.compressedPackets}</div>
            <div>Avg Processing Time: {dataStats.averageProcessingTime.toFixed(2)}ms</div>
            <div>Avg Latency: {dataStats.averageLatency.toFixed(2)}ms</div>
            {processedData && (
              <div className="mt-2 p-2 bg-gray-800 rounded">
                <div>Latitude: {processedData.latitude?.toFixed(6) || "N/A"}</div>
                <div>Temperature: {processedData.temperature?.toFixed(1) || "N/A"}°C</div>
                <div>Battery: {processedData.batteryPercentage?.toFixed(1) || "N/A"}%</div>
                <div>Timestamp: {processedData.timestamp || "N/A"}</div>
                {processedData.processingLatency && (
                  <div className="text-yellow-400">
                    Latency: {processedData.processingLatency.toFixed(2)}ms
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Test Buttons */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Actions:</h4>
          <div className="space-x-2">
            <button 
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              onClick={() => {
                console.log("🔍 Current telemetryData:", telemetryData);
                console.log("🔍 Current processedData:", processedData);
                console.log("🔍 Current terminalContent:", terminalContent);
              }}
            >
              Log States
            </button>
            <button 
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              onClick={() => {
                const testData = {
                  gnss: "$GPGGA,123456,3352.128,S,15112.558,E,1,8,0.9,100.0,M,,M,,*5C",
                  temperature: 25.5,
                  coLevel: 1.2,
                  voltage: 3.7,
                  batteryPercentage: 75,
                  batteryStatus: "Testing",
                  timestamp: Date.now()
                };
                console.log("🧪 Injecting test data:", testData);
                // This will help us test if the flow works with known data
              }}
            >
              Test Data
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 