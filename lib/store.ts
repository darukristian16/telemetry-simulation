import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Global state to track actual port connection outside React
interface SerialGlobals {
  port: any; // SerialPort
  reader: any; // ReadableStreamDefaultReader 
  writer: any; // WritableStreamDefaultWriter
  decoder: TextDecoder;
  rawBuffer: number[]; // Store raw bytes for reliable decoding
}

// Initialize globals outside of React lifecycle with proper decoder options
const globals: SerialGlobals = {
  port: null,
  reader: null,
  writer: null,
  decoder: new TextDecoder('utf-8', { fatal: false }),
  rawBuffer: []
};

// Export the globals for direct access from components
export { globals };

interface SerialState {
  isConnected: boolean;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  lastReceivedData: string;
  terminalContent: string; // Add to store for persistence
  commandHistory: string[];
  port: any | null; // Store SerialPort object in React state
  
  // Actions
  setConnected: (connected: boolean) => void;
  setBaudRate: (baudRate: number) => void;
  setDataBits: (dataBits: number) => void;
  setStopBits: (stopBits: number) => void;
  setParity: (parity: string) => void;
  setLastReceivedData: (data: string) => void;
  setTerminalContent: (data: string | ((prevData: string) => string)) => void; // Add setter
  addToCommandHistory: (command: string) => void;
  clearCommandHistory: () => void;
  clearData: () => void;
  resetConnection: () => void;
  clearCommandHistoryOnStartup: () => void; // New function to clear history on startup
}

// Force clear any existing connection state when the module loads
globals.port = null;
globals.reader = null;
globals.writer = null;

// Create a custom storage adapter that never stores connection state
const customStorage = {
  getItem: (name: string): string | null => {
    const value = localStorage.getItem(name);
    
    if (value) {
      try {
        const parsed = JSON.parse(value);
        // Force these to be reset regardless of what's stored
        parsed.state.isConnected = false;
        parsed.state.port = null;
        return JSON.stringify(parsed);
      } catch (e) {
        return value;
      }
    }
    return value;
  },
  
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      // Always ensure these values are false/null when persisting
      parsed.state.isConnected = false;
      parsed.state.port = null;
      localStorage.setItem(name, JSON.stringify(parsed));
    } catch (e) {
      localStorage.setItem(name, value);
    }
  },
  
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  }
};

export const useSerialStore = create<SerialState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      lastReceivedData: '',
      terminalContent: '', // Initialize empty terminal
      commandHistory: [],
      port: null,
      
      // Actions
      setConnected: (connected) => set(() => ({ isConnected: connected })),
      setBaudRate: (baudRate) => set(() => ({ baudRate })),
      setDataBits: (dataBits) => set(() => ({ dataBits })),
      setStopBits: (stopBits) => set(() => ({ stopBits })),
      setParity: (parity) => set(() => ({ parity })),
      setLastReceivedData: (data) => set(() => ({ lastReceivedData: data })),
      setTerminalContent: (data) => set((state) => ({ 
        terminalContent: typeof data === 'function' ? data(state.terminalContent) : data
      })),
      addToCommandHistory: (command) => set((state) => ({
        commandHistory: [command, ...state.commandHistory].slice(0, 50), // Limit to 50 commands
      })),
      clearCommandHistory: () => {
        // Clear command history in state
        set({ commandHistory: [] });
        
        // Force immediate state persistence to storage to prevent rehydration issues
        try {
          // Explicitly update localStorage to ensure the change persists
          const storageKey = 'serial-storage';
          const storedData = localStorage.getItem(storageKey);
          
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            // Update the command history in the stored data
            if (parsedData.state) {
              parsedData.state.commandHistory = [];
              // Update localStorage with the modified data
              localStorage.setItem(storageKey, JSON.stringify(parsedData));
              console.log('Command history cleared and persisted to storage');
            }
          }
        } catch (err) {
          console.error('Error persisting cleared command history:', err);
        }
      },
      clearData: () => set(() => ({ lastReceivedData: '', terminalContent: '' })),
      resetConnection: () => {
        // Reset connection state first
        set(() => ({ 
          isConnected: false,
          port: null
        }));
        
        // Reset global references to hardware
        globals.port = null;
        globals.reader = null;
        globals.writer = null;
        
        console.log('Connection reset called, all connection state cleared');
      },
      clearCommandHistoryOnStartup: () => {
        // Clear command history in state
        set({ commandHistory: [] });
        
        // Force immediate state persistence to storage to prevent rehydration issues
        try {
          // Explicitly update localStorage to ensure the change persists
          const storageKey = 'serial-storage';
          const storedData = localStorage.getItem(storageKey);
          
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            // Update the command history in the stored data
            if (parsedData.state) {
              parsedData.state.commandHistory = [];
              // Update localStorage with the modified data
              localStorage.setItem(storageKey, JSON.stringify(parsedData));
              console.log('Command history cleared on startup and persisted to storage');
            }
          }
        } catch (err) {
          console.error('Error persisting cleared command history on startup:', err);
        }
      }
    }),
    {
      name: 'serial-storage',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        baudRate: state.baudRate,
        dataBits: state.dataBits,
        stopBits: state.stopBits,
        parity: state.parity,
        terminalContent: state.terminalContent,
        commandHistory: state.commandHistory,
        // Don't persist connection state or port object
        // explicitly exclude port and isConnected from serialization
      }),
      // Add storage event listener to handle multiple tabs
      onRehydrateStorage: () => (state) => {
        // Don't force disconnect on rehydration - let the recovery system handle it
        if (state) {
          // Keep the connection state as-is initially
          // The EnhancedTerminal recovery system will check actual port state
          console.log('🔄 Store rehydrated, letting recovery system check actual connection state');
        }
        
        // Reset globals but don't touch store state - recovery will sync them
        globals.port = null;
        globals.reader = null;
        globals.writer = null;
      }
    }
  )
); 