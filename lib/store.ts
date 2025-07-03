import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Generate a unique session ID for this browser tab/session
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session ID
const getSessionId = () => {
  if (typeof window !== 'undefined') {
    let sessionId = sessionStorage.getItem('serial_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('serial_session_id', sessionId);
    }
    return sessionId;
  }
  return 'server_session';
};

// Timeout wrapper for serial operations to prevent blocking
export const withTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Operation timed out'
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

// Safe serial port request with timeout
export const requestSerialPort = async (): Promise<any> => {
  if (typeof window === 'undefined' || !(navigator as any).serial) {
    throw new Error('Web Serial API not supported');
  }

  return withTimeout(
    () => (navigator as any).serial.requestPort(),
    15000,  // 15 second timeout
    'Serial port selection timed out. Please try again.'
  );
};

// Session-specific state to track actual port connection
interface SessionSerialState {
  port: any; // SerialPort
  reader: any; // ReadableStreamDefaultReader 
  writer: any; // WritableStreamDefaultWriter
  decoder: TextDecoder;
  rawBuffer: number[]; // Store raw bytes for reliable decoding
}

// Create session-specific state holder
const createSessionState = (): SessionSerialState => ({
  port: null,
  reader: null,
  writer: null,
  decoder: new TextDecoder('utf-8', { fatal: false }),
  rawBuffer: []
});

// Store session states in a Map keyed by session ID
const sessionStates = new Map<string, SessionSerialState>();

// Get session-specific state
export const getSessionState = (): SessionSerialState => {
  const sessionId = getSessionId();
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, createSessionState());
  }
  return sessionStates.get(sessionId)!;
};

// Clean up old sessions (optional cleanup function)
export const cleanupOldSessions = () => {
  const currentSessionId = getSessionId();
  sessionStates.forEach((state, sessionId) => {
    if (sessionId !== currentSessionId) {
      // Clean up old session resources
      if (state.reader) {
        try { state.reader.cancel().catch(() => {}); } catch (e) {}
      }
      if (state.writer) {
        try { state.writer.releaseLock(); } catch (e) {}
      }
      if (state.port) {
        try { state.port.close().catch(() => {}); } catch (e) {}
      }
      sessionStates.delete(sessionId);
    }
  });
};

interface SerialState {
  sessionId: string; // Track which session this state belongs to
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

// Create a session-specific storage adapter
const createSessionStorage = () => {
  const sessionId = getSessionId();
  const storageKey = `serial-storage-${sessionId}`;
  
  return {
    getItem: (name: string): string | null => {
      const value = localStorage.getItem(storageKey);
      
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
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      } catch (e) {
        localStorage.setItem(storageKey, value);
      }
    },
    
    removeItem: (name: string): void => {
      localStorage.removeItem(storageKey);
    }
  };
};

export const useSerialStore = create<SerialState>()(
  persist(
    (set, get) => ({
      sessionId: getSessionId(),
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
          const sessionId = getSessionId();
          const storageKey = `serial-storage-${sessionId}`;
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
        
        // Reset session-specific references to hardware
        const sessionState = getSessionState();
        sessionState.port = null;
        sessionState.reader = null;
        sessionState.writer = null;
        
        console.log('Connection reset called, session-specific connection state cleared');
      },
      clearCommandHistoryOnStartup: () => {
        // Clear command history in state
        set({ commandHistory: [] });
        
        // Force immediate state persistence to storage to prevent rehydration issues
        try {
          const sessionId = getSessionId();
          const storageKey = `serial-storage-${sessionId}`;
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
      name: `serial-storage-${getSessionId()}`,
      storage: createJSONStorage(() => createSessionStorage()),
      partialize: (state) => ({
        sessionId: state.sessionId,
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
          console.log('🔄 Store rehydrated for session:', state.sessionId, 'letting recovery system check actual connection state');
        }
        
        // Reset session-specific state but don't touch store state - recovery will sync them
        const sessionState = getSessionState();
        sessionState.port = null;
        sessionState.reader = null;
        sessionState.writer = null;
        
        // Clean up old sessions
        cleanupOldSessions();
      }
    }
  )
); 