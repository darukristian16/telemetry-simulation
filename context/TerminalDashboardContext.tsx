"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the processed data structure (always uncompressed for Dashboard)
export interface ProcessedTelemetryData {
  // GPS Data
  latitude: number;
  longitude: number;
  altitude: number;
  
  // Sensor Data
  temperature: number;
  coLevel: number;
  no2Level: number;
  so2Level: number;
  
  // Battery Data
  voltage: number;
  current: number;
  batteryPercentage: number;
  batteryStatus: string;
  
  // System Data
  timestamp: number;
  flightTime: number;
  
  // Processing metadata
  dataSource: 'raw' | 'decompressed'; // Indicates if data was compressed before processing
  processingTime?: number; // Time taken to process/decompress data (ms)
  processingLatency?: number; // Time from transmission to processing (ms)
}

// Define the context interface
interface TerminalDashboardContextType {
  processedData: ProcessedTelemetryData | null;
  setProcessedData: React.Dispatch<React.SetStateAction<ProcessedTelemetryData | null>>;
  isReceivingData: boolean;
  setIsReceivingData: React.Dispatch<React.SetStateAction<boolean>>;
  lastUpdateTime: number;
  setLastUpdateTime: React.Dispatch<React.SetStateAction<number>>;
  dataStats: {
    totalPacketsReceived: number;
    rawPackets: number;
    compressedPackets: number;
    averageProcessingTime: number;
    averageLatency: number;
  };
  updateDataStats: (processingTime: number, wasCompressed: boolean, latency?: number) => void;
  resetStats: () => void;
}

// Default processed data
const defaultProcessedData: ProcessedTelemetryData = {
  latitude: -33.8688,
  longitude: 151.2093,
  altitude: 100,
  temperature: 25,
  coLevel: 1.2,
  no2Level: 100,
  so2Level: 10,
  voltage: 25,
  current: 1.5,
  batteryPercentage: 100,
  batteryStatus: "Discharging",
  timestamp: Date.now(),
  flightTime: 0,
  dataSource: 'raw'
};

// Create the context
const TerminalDashboardContext = createContext<TerminalDashboardContextType | undefined>(undefined);

// Create a provider component
export function TerminalDashboardProvider({ children }: { children: ReactNode }) {
  const [processedData, setProcessedData] = useState<ProcessedTelemetryData | null>(defaultProcessedData);
  const [isReceivingData, setIsReceivingData] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [dataStats, setDataStats] = useState({
    totalPacketsReceived: 0,
    rawPackets: 0,
    compressedPackets: 0,
    averageProcessingTime: 0,
    averageLatency: 0
  });
  
  // Debug: Log when data changes
  const debugSetProcessedData = (newData: ProcessedTelemetryData | null) => {
    console.log('📊 TerminalDashboardContext: setProcessedData called with:', newData);
    setProcessedData(newData);
  };

  const updateDataStats = (processingTime: number, wasCompressed: boolean, latency?: number) => {
    setDataStats(prev => {
      const newTotal = prev.totalPacketsReceived + 1;
      const newRaw = wasCompressed ? prev.rawPackets : prev.rawPackets + 1;
      const newCompressed = wasCompressed ? prev.compressedPackets + 1 : prev.compressedPackets;
      
      // Calculate running average of processing time
      const newAverageProcessingTime = 
        (prev.averageProcessingTime * prev.totalPacketsReceived + processingTime) / newTotal;
      
      // Calculate running average of latency
      const newAverageLatency = 
        (prev.averageLatency * prev.totalPacketsReceived + (latency || 0)) / newTotal;
      
      return {
        totalPacketsReceived: newTotal,
        rawPackets: newRaw,
        compressedPackets: newCompressed,
        averageProcessingTime: newAverageProcessingTime,
        averageLatency: newAverageLatency
      };
    });
  };

  const resetStats = () => {
    setDataStats({
      totalPacketsReceived: 0,
      rawPackets: 0,
      compressedPackets: 0,
      averageProcessingTime: 0,
      averageLatency: 0
    });
  };

  return (
    <TerminalDashboardContext.Provider
      value={{
        processedData,
        setProcessedData: debugSetProcessedData,
        isReceivingData,
        setIsReceivingData,
        lastUpdateTime,
        setLastUpdateTime,
        dataStats,
        updateDataStats,
        resetStats
      }}
    >
      {children}
    </TerminalDashboardContext.Provider>
  );
}

// Custom hook to use the terminal-dashboard context
export function useTerminalDashboard() {
  const context = useContext(TerminalDashboardContext);
  if (context === undefined) {
    throw new Error('useTerminalDashboard must be used within a TerminalDashboardProvider');
  }
  return context;
} 