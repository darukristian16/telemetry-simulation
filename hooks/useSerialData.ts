import { useState, useEffect, useRef } from 'react';
import { useSerialStore, getSessionState } from '@/lib/store';

export interface SerialData {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  connected: boolean;
  lastData: string;
}

export function useSerialData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preventAutoConnectRef = useRef(true);
  
  const { 
    isConnected, 
    baudRate, 
    lastReceivedData, 
    commandHistory,
    setConnected,
    setBaudRate,
    setLastReceivedData,
    addToCommandHistory,
    clearCommandHistory,
    clearData
  } = useSerialStore();

  // DISABLED: Check for ongoing connections on mount
  // We don't want automatic connections anymore
  useEffect(() => {
    // Don't auto-connect on page load/refresh
    if (preventAutoConnectRef.current) {
      console.log('Preventing auto-connection on page load');
      // Force disconnect state
      if (isConnected) {
        setConnected(false);
      }
      // Reset session-specific references
      const sessionState = getSessionState();
      sessionState.port = null;
      sessionState.reader = null;
      sessionState.writer = null;
      
      preventAutoConnectRef.current = false;
      return;
    }
    
    // Original logic - only run if we've explicitly opted out of prevention
    // If we have a port reference but our state doesn't show connected,
    // update the state to match reality
    const sessionState = getSessionState();
    if (!preventAutoConnectRef.current && sessionState.port && !isConnected) {
      console.log('Active port found, updating connection state');
      setConnected(true);
    }
  }, [isConnected, setConnected]);

  // Fetch initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/serial');
        
        if (!response.ok) {
          throw new Error('Failed to fetch serial data');
        }
        
        const data = await response.json();
        
        if (data.serialConnection) {
          // Only update these if they exist in the response
          if (data.serialConnection.baudRate) {
            setBaudRate(data.serialConnection.baudRate);
          }
          
          if (data.serialConnection.lastData) {
            setLastReceivedData(data.serialConnection.lastData);
          }
          
          if (data.serialConnection.connected !== undefined) {
            // Only update our connected state if we don't have an active port reference
            const sessionState = getSessionState();
            if (!sessionState.port) {
              setConnected(data.serialConnection.connected);
            } else {
              // If we have an active port but DB says not connected, update DB
              if (!data.serialConnection.connected) {
                await saveSerialState({ connected: true });
              }
            }
          }
        }
        
        // Load command history
        if (data.commandHistory && Array.isArray(data.commandHistory)) {
          // Clear the current history and add all commands
          clearCommandHistory();
          data.commandHistory.forEach((cmd: string) => {
            addToCommandHistory(cmd);
          });
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching serial data:', err);
        setError('Failed to load serial data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Function to save the serial connection state to the backend
  const saveSerialState = async (data: Partial<SerialData>) => {
    try {
      const response = await fetch('/api/serial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save serial data');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Error saving serial data:', err);
      setError('Failed to save serial data');
      throw err;
    }
  };
  
  // Function to save a command to history
  const saveCommand = async (command: string) => {
    try {
      // Update local state
      addToCommandHistory(command);
      
      // Save to backend
      await fetch('/api/command-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      console.error('Error saving command:', err);
    }
  };
  
  // Function to clear command history
  const clearHistory = async () => {
    try {
      // Update local state
      clearCommandHistory();
      
      // Clear in backend
      await fetch('/api/command-history', {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error clearing command history:', err);
    }
  };
  
  // Function to disconnect and reset data
  const resetConnection = async () => {
    try {
      // Update local state
      setConnected(false);
      
      // Reset in backend
      await fetch('/api/serial', {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error resetting connection:', err);
    }
  };
  
  return {
    loading,
    error,
    serialData: {
      isConnected,
      baudRate,
      lastReceivedData,
      commandHistory,
    },
    actions: {
      saveSerialState,
      saveCommand,
      clearHistory,
      resetConnection,
      setConnected,
      setBaudRate,
      setLastReceivedData,
      clearData,
    },
  };
} 