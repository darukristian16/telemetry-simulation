"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Interface for processed data (matches Terminal's ProcessedTelemetryData)
export interface ProcessedTelemetryData {
  // GPS Data
  latitude?: number;
  longitude?: number;
  altitude?: number;
  hdop?: number;
  satellites?: number;
  
  // Sensor Data
  temperature?: number;
  coLevel?: number;
  no2Level?: number;
  so2Level?: number;
  
  // Battery Data
  voltage?: number;
  current?: number;
  batteryPercentage?: number;
  batteryStatus?: string;
  
  // System Data
  timestamp?: number;
  flightTime?: number;
  
  // Processing metadata
  wasCompressed?: boolean;
  processingTime?: number;
}

// Interface for data history entry
interface DataHistoryEntry {
  timestamp: number;
  data: ProcessedTelemetryData;
}

// Context interface
interface ProcessedDataContextType {
  // Current processed data
  currentData: ProcessedTelemetryData | null;
  
  // Data history (last 100 entries)
  dataHistory: DataHistoryEntry[];
  
  // Connection status
  isReceivingData: boolean;
  lastUpdateTimestamp: number | null;
  
  // Methods to update data
  updateProcessedData: (data: ProcessedTelemetryData) => void;
  clearData: () => void;
  setReceivingStatus: (status: boolean) => void;
  
  // Statistics
  totalDataReceived: number;
  compressionRatio: number;
}

// Create context
const ProcessedDataContext = createContext<ProcessedDataContextType | undefined>(undefined);

// Provider component
export function ProcessedDataProvider({ children }: { children: ReactNode }) {
  const [currentData, setCurrentData] = useState<ProcessedTelemetryData | null>(null);
  const [dataHistory, setDataHistory] = useState<DataHistoryEntry[]>([]);
  const [isReceivingData, setIsReceivingData] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number | null>(null);
  const [totalDataReceived, setTotalDataReceived] = useState(0);
  const [compressionRatio, setCompressionRatio] = useState(0);

  // Update processed data
  const updateProcessedData = (data: ProcessedTelemetryData) => {
    const timestamp = Date.now();
    
    // Update current data
    setCurrentData(data);
    setLastUpdateTimestamp(timestamp);
    setTotalDataReceived(prev => prev + 1);
    
    // Add to history (keep last 100 entries)
    setDataHistory(prev => {
      const newEntry: DataHistoryEntry = { timestamp, data };
      const updated = [newEntry, ...prev].slice(0, 100);
      return updated;
    });
    
    // Update compression ratio if available
    if (data.wasCompressed !== undefined) {
      setCompressionRatio(prev => {
        // Simple running average of compression status
        const totalEntries = Math.min(totalDataReceived + 1, 100);
        const compressedCount = dataHistory.filter(entry => entry.data.wasCompressed).length + (data.wasCompressed ? 1 : 0);
        return totalEntries > 0 ? (compressedCount / totalEntries) * 100 : 0;
      });
    }
    
    console.log('📡 Processed data updated in shared context:', data);
  };

  // Clear all data
  const clearData = () => {
    setCurrentData(null);
    setDataHistory([]);
    setLastUpdateTimestamp(null);
    setTotalDataReceived(0);
    setCompressionRatio(0);
    console.log('🧹 Processed data context cleared');
  };

  // Set receiving status
  const setReceivingStatus = (status: boolean) => {
    setIsReceivingData(status);
    console.log(`📡 Data receiving status: ${status ? 'ON' : 'OFF'}`);
  };

  const contextValue: ProcessedDataContextType = {
    currentData,
    dataHistory,
    isReceivingData,
    lastUpdateTimestamp,
    updateProcessedData,
    clearData,
    setReceivingStatus,
    totalDataReceived,
    compressionRatio
  };

  return (
    <ProcessedDataContext.Provider value={contextValue}>
      {children}
    </ProcessedDataContext.Provider>
  );
}

// Hook to use the context
export function useProcessedData() {
  const context = useContext(ProcessedDataContext);
  if (context === undefined) {
    throw new Error('useProcessedData must be used within a ProcessedDataProvider');
  }
  return context;
} 