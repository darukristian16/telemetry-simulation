"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTelemetry } from '@/context/TelemetryContext';

export function DataStructureDebugger() {
  const { telemetryData, compressionSettings } = useTelemetry();

  // Helper to check if data is compressed
  const isCompressed = !!telemetryData.compressionMetrics;

  // Helper to get the data structure type
  const getDataType = () => {
    if (compressionSettings.enabled && isCompressed) {
      return "Compressed (Buffers)";
    }
    return "Raw Values";
  };

  // Helper to get structure details
  const getStructureDetails = () => {
    if (compressionSettings.enabled && isCompressed) {
      return {
        hasBuffers: true,
        gnssBuffer: telemetryData.gnssBuffer ? `${telemetryData.gnssBuffer.length} bytes` : "No buffer",
        temperatureBuffer: telemetryData.temperatureBuffer ? `${telemetryData.temperatureBuffer.length} bytes` : "No buffer",
        batteryBuffer: telemetryData.batteryBuffer ? `${telemetryData.batteryBuffer.length} bytes` : "No buffer",
        coBuffer: telemetryData.coBuffer ? `${telemetryData.coBuffer.length} bytes` : "No buffer",
        no2Buffer: telemetryData.no2Buffer ? `${telemetryData.no2Buffer.length} bytes` : "No buffer",
        so2Buffer: telemetryData.so2Buffer ? `${telemetryData.so2Buffer.length} bytes` : "No buffer"
      };
    } else {
      return {
        hasBuffers: false,
        latitude: telemetryData.latitude,
        longitude: telemetryData.longitude,
        altitude: telemetryData.altitude,
        temperature: telemetryData.temperature,
        coLevel: telemetryData.coLevel,
        no2Level: telemetryData.no2Level,
        so2Level: telemetryData.so2Level,
        voltage: telemetryData.voltage,
        current: telemetryData.current,
        batteryPercentage: telemetryData.batteryPercentage,
        batteryStatus: telemetryData.batteryStatus
      };
    }
  };

  const structure = getStructureDetails();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Data Structure Monitor
          <Badge 
            variant="outline" 
            className={compressionSettings.enabled ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}
          >
            {getDataType()}
          </Badge>
        </CardTitle>
        <CardDescription>
          Real-time view of telemetry data structure sent to Terminal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compression Status */}
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span className="font-medium">Compression Status:</span>
          <Badge variant={compressionSettings.enabled ? "default" : "secondary"}>
            {compressionSettings.enabled ? "ENABLED" : "DISABLED"}
          </Badge>
        </div>

        {/* Data Structure Details */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
            Current Data Structure:
          </h4>
          
          {structure.hasBuffers ? (
            // Compressed data structure
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                <div className="font-medium text-blue-800">GNSS Buffer</div>
                <div className="text-blue-600">{structure.gnssBuffer}</div>
              </div>
              <div className="p-2 bg-green-50 rounded border-l-4 border-green-400">
                <div className="font-medium text-green-800">Temperature Buffer</div>
                <div className="text-green-600">{structure.temperatureBuffer}</div>
              </div>
              <div className="p-2 bg-purple-50 rounded border-l-4 border-purple-400">
                <div className="font-medium text-purple-800">Battery Buffer</div>
                <div className="text-purple-600">{structure.batteryBuffer}</div>
              </div>
              <div className="p-2 bg-orange-50 rounded border-l-4 border-orange-400">
                <div className="font-medium text-orange-800">CO Buffer</div>
                <div className="text-orange-600">{structure.coBuffer}</div>
              </div>
              <div className="p-2 bg-red-50 rounded border-l-4 border-red-400">
                <div className="font-medium text-red-800">NO2 Buffer</div>
                <div className="text-red-600">{structure.no2Buffer}</div>
              </div>
              <div className="p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                <div className="font-medium text-yellow-800">SO2 Buffer</div>
                <div className="text-yellow-600">{structure.so2Buffer}</div>
              </div>
            </div>
          ) : (
            // Raw data structure
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="font-medium text-gray-800">GPS Data</div>
                <div className="text-gray-600 space-y-1">
                  <div>Lat: {structure.latitude?.toFixed(4) || 'N/A'}</div>
                  <div>Lon: {structure.longitude?.toFixed(4) || 'N/A'}</div>
                  <div>Alt: {structure.altitude?.toFixed(1) || 'N/A'}m</div>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="font-medium text-gray-800">Sensors</div>
                <div className="text-gray-600 space-y-1">
                  <div>Temp: {structure.temperature?.toFixed(1) || 'N/A'}°C</div>
                  <div>CO: {structure.coLevel?.toFixed(0) || 'N/A'}</div>
                  <div>NO2: {structure.no2Level?.toFixed(0) || 'N/A'}</div>
                  <div>SO2: {structure.so2Level?.toFixed(0) || 'N/A'}</div>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="font-medium text-gray-800">Battery</div>
                <div className="text-gray-600 space-y-1">
                  <div>V: {structure.voltage?.toFixed(2) || 'N/A'}V</div>
                  <div>I: {structure.current?.toFixed(2) || 'N/A'}A</div>
                  <div>%: {structure.batteryPercentage?.toFixed(0) || 'N/A'}%</div>
                  <div>{structure.batteryStatus || 'N/A'}</div>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="font-medium text-gray-800">System</div>
                <div className="text-gray-600 space-y-1">
                  <div>Time: {new Date(telemetryData.timestamp || Date.now()).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* JSON Preview */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
            JSON Structure Preview:
          </h4>
          <div className="p-3 bg-black text-green-400 rounded-lg font-mono text-xs overflow-auto max-h-40">
            <pre>{JSON.stringify(telemetryData, null, 2)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 