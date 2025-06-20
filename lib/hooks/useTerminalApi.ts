import { useState, useCallback, useEffect } from 'react';

interface UseTerminalApiReturn {
  isReading: boolean;
  startReading: () => void;
  stopReading: () => void;
}

export function useTerminalApi(
  apiEndpoint: string,
  readInterval: number = 1000
): UseTerminalApiReturn {
  const [isReading, setIsReading] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Here you can handle the data as needed
      console.log('Received data:', data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [apiEndpoint]);

  const startReading = useCallback(() => {
    if (!isReading) {
      setIsReading(true);
      // Fetch immediately when starting
      fetchData();
      // Then set up interval
      const id = setInterval(fetchData, readInterval);
      setIntervalId(id);
    }
  }, [isReading, fetchData, readInterval]);

  const stopReading = useCallback(() => {
    if (isReading && intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
      setIsReading(false);
    }
  }, [isReading, intervalId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  return {
    isReading,
    startReading,
    stopReading,
  };
} 