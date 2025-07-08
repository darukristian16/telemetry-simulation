"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSerialStore, getSessionState, requestSerialPort } from '@/lib/store';
import { ConnectStatus } from './connect-status';

export function EnhancedTerminal() {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'disconnecting'>('idle');
  const terminalRef = useRef<HTMLDivElement>(null);
  const disconnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  
  // Access serial state and methods from store
  const { 
    isConnected, 
    terminalContent, 
    setConnected,
    setTerminalContent,
    port: serialPort,
    baudRate,
    commandHistory,
    addToCommandHistory,
    clearCommandHistory,
    resetConnection
  } = useSerialStore();
  
  // Define device info state
  const [deviceInfo, setDeviceInfo] = useState({
    baudRate: baudRate,
    dataBits: 8,
    status: 'Disconnected',
  });
  
  // Track input mode: direct (char-by-char) or command mode (for AT commands)
  const [inputMode, setInputMode] = useState<'direct' | 'command'>('direct');
  
  // Track reader and writer for current session
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const readLoopActiveRef = useRef(false);

  // Handle scroll behavior
  const [autoScroll, setAutoScroll] = useState(true);
  
  // For error display
  const [error, setError] = useState<string | null>(null);
  
  // Quick commands list
  const [quickCommands, setQuickCommands] = useState([
    { label: "Help", command: "help" },
    { label: "Status", command: "AT&V" },
    { label: "Save", command: "AT&W" },
    { label: "Reset", command: "AT&F" },
  ]);
  
  // Buffer for incomplete lines across chunks
  const lineBufferRef = useRef('');
  
  // Update device info when connection status changes
  useEffect(() => {
    setDeviceInfo({
      baudRate: baudRate,
      dataBits: 8,
      status: isConnected ? 'Connected' : 'Disconnected',
    });
  }, [isConnected, baudRate]);
  
  // Connection recovery system - check for existing connections on mount
  useEffect(() => {
    // Only run this once
    if (!hasInitializedRef.current) {
      console.log('🔍 Terminal component mounted, checking for existing connections...');
      
      // Check session-specific state instead of shared store
      const sessionState = getSessionState();
      const storeIsConnected = useSerialStore.getState().isConnected;
      
      console.log('Terminal Session state:', {
        hasPort: !!sessionState.port,
        isConnected: storeIsConnected,
        portReadable: !!sessionState.port?.readable,
        portWritable: !!sessionState.port?.writable,
        portReadableLocked: !!sessionState.port?.readable?.locked
      });
      
      if (sessionState.port && (sessionState.port.readable || sessionState.port.writable)) {
        console.log('📡 Found existing open port in session state...');
        
        // Always reset refs to ensure clean state
        readLoopActiveRef.current = false;
        readerRef.current = null;
        writerRef.current = null;
        
        // Update state to match the actual connection
        setConnected(true);
        useSerialStore.setState({ 
          port: sessionState.port,
          isConnected: true 
        });
        
        // Update device info to show connected status
        setDeviceInfo({
          baudRate: baudRate,
          dataBits: 8,
          status: 'Connected',
        });
      
        // NEVER start our own read loop if port is already locked (SerialTelemetryBridge is active)
        if (sessionState.port.readable?.locked) {
          console.log('📡 SerialTelemetryBridge is already reading from port - Terminal will be passive');
        } else if (sessionState.port.readable && !sessionState.port.readable.locked) {
          console.log('🔄 Port not locked, Terminal can start read loop');
          // Small delay to ensure component is fully mounted
          setTimeout(() => {
            try {
              readFromPort(sessionState.port);
            } catch (error) {
              console.log('❌ Error starting read loop for recovered connection:', error);
            }
          }, 100);
        }
        
        console.log('✅ Terminal connection state updated');
      } else {
        console.log('❌ No existing connection found, ensuring clean state');
        
        // Ensure state is clean if no valid connection exists
        setConnected(false);
        useSerialStore.setState({ isConnected: false, port: null });
        setDeviceInfo({
          baudRate: baudRate,
          dataBits: 8,
          status: 'Disconnected',
        });
      }
      
      hasInitializedRef.current = true;
    }
    
    // Clean up on unmount
    return () => {
      console.log('Terminal component unmounting, checking if it should clean up...');
      
      // Check if SerialTelemetryBridge is using the port
      const sessionState = getSessionState();
      const portIsLocked = sessionState.port?.readable?.locked;
      
      if (portIsLocked) {
        console.log('📡 SerialTelemetryBridge is using the port, Terminal will NOT interfere with cleanup');
        // Don't interfere with SerialTelemetryBridge - just clean our refs
      readLoopActiveRef.current = false;
        readerRef.current = null;
        writerRef.current = null;
        return;
      }
      
      console.log('🧹 Terminal cleaning up its own resources');
      
      // Stop the read loop only if we own it
      readLoopActiveRef.current = false;
      
      // Properly release reader if we have one and we own it
      if (readerRef.current) {
        try {
          readerRef.current.cancel().catch(() => {});
          readerRef.current.releaseLock();
          console.log('Terminal: Reader released on unmount');
        } catch (error) {
          console.log('Terminal: Error releasing reader on unmount:', error);
        }
        readerRef.current = null;
      }
      
      // Properly release writer if we have one
      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
          console.log('Terminal: Writer released on unmount');
        } catch (error) {
          console.log('Terminal: Error releasing writer on unmount:', error);
        }
        writerRef.current = null;
      }
    };
  }, [resetConnection]);

  // Periodic state synchronization - keep UI in sync with actual port state
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const sessionState = getSessionState();
      const storeIsConnected = useSerialStore.getState().isConnected;
      
      // Check if our local state matches the actual port state
      const actuallyConnected = sessionState.port && (sessionState.port.readable || sessionState.port.writable);
      
      if (actuallyConnected && !storeIsConnected) {
        console.log('🔄 Syncing: Port is open but store shows disconnected, fixing...');
        useSerialStore.setState({ isConnected: true, port: sessionState.port });
        setConnected(true);
        setDeviceInfo(prev => ({ ...prev, status: 'Connected' }));
      } else if (!actuallyConnected && storeIsConnected) {
        console.log('🔄 Syncing: Port is closed but store shows connected, fixing...');
        useSerialStore.setState({ isConnected: false, port: null });
        sessionState.port = null;
        setConnected(false);
        setDeviceInfo(prev => ({ ...prev, status: 'Disconnected' }));
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(syncInterval);
  }, []);
  
  // Auto-scroll when content changes
  useEffect(() => {
    if (terminalRef.current && autoScroll) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalContent, autoScroll]);

  // Check scroll position to control auto-scroll
  const handleTerminalScroll = () => {
    if (!terminalRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };
  
  // Connect to serial device
  const handleConnect = async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      // Request a port from the user with timeout to prevent blocking
      const port = await requestSerialPort();
      console.log('Port selected by user');
      
      // Get session state for this user
      const sessionState = getSessionState();
      
      // Check if port is already open - if so, just use it instead of trying to close
      if (port.readable || port.writable) {
        console.log('Port is already open, using existing connection');
        
        // Store port in both session state and store
        sessionState.port = port;
        useSerialStore.setState({ port, isConnected: true });
        setConnected(true);
        
        // Only start reading if not already locked by SerialTelemetryBridge
        if (!port.readable?.locked) {
        readFromPort(port);
        } else {
          console.log('📡 SerialTelemetryBridge is already reading, using shared content');
        }
        
        setStatus('idle');
        return;
      }
      
      // Open the port with specified baud rate
      await port.open({ 
        baudRate: baudRate,
        dataBits: 8, 
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      
      console.log(`Serial port opened at ${baudRate} baud`);
      
      // Store port in both session state and store
      sessionState.port = port;
      useSerialStore.setState({ port, isConnected: true });
      setConnected(true);
      
      // Only start reading if not already locked by SerialTelemetryBridge
      if (!port.readable?.locked) {
      readFromPort(port);
      } else {
        console.log('📡 SerialTelemetryBridge is already reading, using shared content');
      }
      
      setStatus('idle');
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(`Failed to connect: ${err.message || String(err)}`);
      setConnected(false);
      setStatus('idle');
    }
  };
  
  // Clean disconnect function with improved reliability
  const handleDisconnect = async () => {
    if (disconnectingRef.current) {
      console.log('Disconnect already in progress, ignoring request');
      return;
    }
    
    disconnectingRef.current = true;
    setStatus('disconnecting');
    setError(null);
    
    try {
      console.log('Starting disconnection process');
      
      // Set up a timeout to force disconnect after 5 seconds
      const timeoutId = setTimeout(() => {
        console.warn('Disconnect timed out, forcing cleanup');
        forceCleanup();
      }, 5000);
      
      // Stop the read loop
      readLoopActiveRef.current = false;
      
      // Cancel reader if active
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
          console.log('Reader cancelled');
        } catch (err) {
          console.warn('Error cancelling reader:', err);
        }
        try {
          readerRef.current.releaseLock();
          console.log('Reader lock released');
        } catch (err) {
          console.warn('Error releasing reader lock:', err);
        }
        readerRef.current = null;
      }
      
      // Release writer if active
      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
          console.log('Writer lock released');
        } catch (err) {
          console.warn('Error releasing writer lock:', err);
        }
        writerRef.current = null;
      }
      
      // Close port if available
      const sessionState = getSessionState();
      const port = sessionState.port;
      if (port) {
        try {
          await Promise.race([
            port.close(),
            new Promise(r => setTimeout(r, 2000)) // 2 second timeout for closing
          ]);
          console.log('Port closed successfully');
        } catch (err) {
          console.warn('Error closing port:', err);
        }
      }
      
      // Clear the timeout since we're done
      clearTimeout(timeoutId);
      
      // Update state
      sessionState.port = null;
      setConnected(false);
      useSerialStore.setState({ port: null, isConnected: false });
      
      console.log('Disconnect completed successfully');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError(`Failed to disconnect: ${err.message || String(err)}`);
      forceCleanup();
    } finally {
      setStatus('idle');
      disconnectingRef.current = false;
    }
  };
  
  // Force cleanup in case of errors
  const forceCleanup = () => {
    console.log('Forcing cleanup of all resources');
    readerRef.current = null;
    writerRef.current = null;
    setConnected(false);
    useSerialStore.setState({ port: null, isConnected: false });
    readLoopActiveRef.current = false;
  };
  
  // Read data from the serial port with improved error handling
  const readFromPort = async (port: any) => {
    if (!port.readable) {
      console.error('Port is not readable');
      return;
    }
    // Check if stream is already locked
    if (port.readable.locked) {
      console.log('⚠️ Readable stream is already locked by SerialTelemetryBridge, using shared terminal content');
      // Don't start our own reader - let SerialTelemetryBridge handle it
      // The terminal will display content from the shared terminalContent state
      return;
    }
    try {
      readLoopActiveRef.current = true;
      while (port.readable && readLoopActiveRef.current) {
        let reader;
        try {
          reader = port.readable.getReader();
          readerRef.current = reader;
        } catch (error: any) {
          if (error.message?.includes('locked')) {
            console.log('⚠️ Stream became locked while trying to get reader, stopping');
            break;
          }
          throw error;
        }
        try {
          console.log('Starting read loop');
          while (readLoopActiveRef.current) {
            const { value, done } = await reader.read();
            if (done) {
              console.log('Reader signaled "done"');
              break;
            }
            if (value) {
              // Decode the incoming data
              const decoder = new TextDecoder('utf-8', { fatal: false });
              let text = decoder.decode(value, { stream: true });
              
              // Display data immediately for real-time feedback
              setTerminalContent(prev => prev + text);
              
              // Also maintain line buffer for proper line handling (if needed for other features)
              lineBufferRef.current += text;
              
              // Clean up the line buffer periodically to prevent memory issues
              if (lineBufferRef.current.length > 10000) {
                lineBufferRef.current = lineBufferRef.current.slice(-5000);
              }
              
              // Scroll to bottom without delay
              requestAnimationFrame(() => {
                if (terminalRef.current && autoScroll) {
                  terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                }
              });
            }
          }
        } catch (error: any) {
          console.error('Error in read loop:', error);
          if (readLoopActiveRef.current) {
            setError(`Read error: ${error.message || String(error)}`);
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (e) {
              console.warn('Error releasing reader lock:', e);
            }
            readerRef.current = null;
          }
        }
        if (!readLoopActiveRef.current) {
          console.log('Read loop terminated by user');
          break;
        }
        // Short delay before retrying
        await new Promise(r => setTimeout(r, 500));
      }
      // Clear the line buffer when connection ends (data is already displayed)
      lineBufferRef.current = '';
    } catch (err: any) {
      console.error('Fatal error in read process:', err);
      setError(`Fatal read error: ${err.message || String(err)}`);
      if (!disconnectingRef.current) {
        forceCleanup();
      }
    }
  };
  
  // Send a single character to the device
  const sendCharacter = async (char: string) => {
    if (!isConnected || status !== 'idle') return;
    
    const sessionState = getSessionState();
    const port = sessionState.port;
    if (!port || !port.writable) {
      setError('Cannot write to port: port is not writable');
      return;
    }
    
    try {
      const writer = port.writable.getWriter();
      writerRef.current = writer;
      
      try {
        // Convert the character to bytes and send
        const encoder = new TextEncoder();
        const data = encoder.encode(char);
        await writer.write(data);
        
        // Log the character sent
        console.log(`Character sent: ${JSON.stringify(char)}`);
      } finally {
        try {
          writer.releaseLock();
        } catch (e) {
          console.warn('Error releasing writer lock:', e);
        }
        writerRef.current = null;
      }
    } catch (err: any) {
      console.error('Send error:', err);
      setError(`Failed to send character: ${err.message || String(err)}`);
    }
  };
  
  // Handle input change based on current mode
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (inputMode === 'direct') {
      // Direct mode - send character by character
      const lastChar = value.slice(-1);
      
      // Only process if connected and has a character to send
      if (isConnected && status === 'idle' && lastChar) {
        // Send only the last character that was typed
        sendCharacter(lastChar);
      }
      
      // Keep input field empty for next character
      setInputText('');
    } else {
      // Command mode - accumulate text until Enter is pressed
      setInputText(value);
    }
  };
  
  // Handle key down events for command mode
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputMode === 'command' && inputText.trim()) {
      sendFullCommand(inputText);
      setInputText('');
    }
  };
  
  // Send a full command (for command mode)
  const sendFullCommand = async (command: string) => {
    if (!isConnected || status !== 'idle') return;
    
    const sessionState = getSessionState();
    const port = sessionState.port;
    if (!port || !port.writable) {
      setError('Cannot write to port: port is not writable');
      return;
    }
    
    try {
      const writer = port.writable.getWriter();
      writerRef.current = writer;
      
      try {
        // Format command with appropriate line ending
        let formattedCommand = command;
        if (command.toUpperCase().trim().startsWith('AT')) {
          // AT commands need CR+LF
          if (!formattedCommand.endsWith('\r\n')) {
            formattedCommand = formattedCommand.replace(/[\r\n]+$/, '') + '\r\n';
          }
        } else if (!formattedCommand.endsWith('\n')) {
          // Add newline for other commands if missing
          formattedCommand += '\n';
        }
        
        // Convert to bytes and send
        const encoder = new TextEncoder();
        const data = encoder.encode(formattedCommand);
        await writer.write(data);
        
        console.log(`Command sent: ${JSON.stringify(formattedCommand)}`);
        
        // Add to command history
        addToCommandHistory(command.trim());
      } finally {
        try {
          writer.releaseLock();
        } catch (e) {
          console.warn('Error releasing writer lock:', e);
        }
        writerRef.current = null;
      }
    } catch (err: any) {
      console.error('Send error:', err);
      setError(`Failed to send command: ${err.message || String(err)}`);
    }
  };
  
  // Send a quick command
  const sendQuickCommand = async (command: string) => {
    if (!isConnected || status !== 'idle') return;
    
    try {
      if (inputMode === 'direct') {
        // Send command character by character in direct mode
        for (let i = 0; i < command.length; i++) {
          await sendCharacter(command[i]);
        }
        
        // If command doesn't end with newline, send one
        if (!command.endsWith('\n') && !command.endsWith('\r\n')) {
          await sendCharacter('\n');
        }
      } else {
        // Send as a single command in command mode
        await sendFullCommand(command);
      }
      
      // Add to command history
      addToCommandHistory(command.trim());
    } catch (err: any) {
      console.error('Error sending quick command:', err);
      setError(`Failed to send command: ${err.message || String(err)}`);
    }
  };
  
  // Resend a command from history
  const resendCommand = async (command: string) => {
    if (!isConnected || status !== 'idle') return;
    
    try {
      await sendQuickCommand(command);
    } catch (err: any) {
      console.error('Error resending command:', err);
      setError(`Failed to resend command: ${err.message || String(err)}`);
    }
  };
  
  // Clear the terminal content
  const handleClear = () => {
    setTerminalContent('');
    setError(null);
  };
  
  // Export terminal content
  const handleExport = () => {
    try {
      const element = document.createElement('a');
      const file = new Blob([terminalContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `terminal_${new Date().toISOString().replace(/:/g, '-')}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err: any) {
      setError(`Export failed: ${err.message || String(err)}`);
    }
  };
  
  // Handle clearing command history
  const handleClearHistory = () => {
    // Clear command history in the store
    clearCommandHistory();
    
    // Also attempt to clear in backend (API) if available
    try {
      // If there's an API endpoint for clearing history, call it
      fetch('/api/command-history', {
        method: 'DELETE',
      }).then(() => {
        console.log('Command history cleared in backend');
      }).catch(err => {
        console.warn('Could not clear command history in backend:', err);
      });
    } catch (err) {
      console.warn('Error clearing command history in backend:', err);
    }
  };
  
  // Render terminal content - optimized to handle large text
  const renderTerminalContent = () => {
    if (!terminalContent) {
      return (
        <div className="text-gray-500 italic flex h-full items-center justify-center">
          Terminal is empty. Connect to a device and send commands to see output here.
        </div>
      );
    }
    
    return <div className="whitespace-pre-wrap break-all">{terminalContent}</div>;
  };

  return (
    <div className="font-sans w-full h-full p-4">
      {/* Connection Status Card */}
      <ConnectStatus 
        isConnected={isConnected} 
        onConnectClick={isConnected ? handleDisconnect : handleConnect} 
        error={error}
      />

      {/* Main Content - Two Columns */}
      <div className="flex flex-col md:flex-row gap-4 mt-4" style={{ height: "680px" }}>
        {/* Left Column - Terminal */}
        <div className="w-full md:w-3/5 h-full">
          <div className="h-full p-4 rounded-lg shadow-md flex flex-col" style={{ backgroundColor: "#1E293B" }}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                <h2 className="text-lg font-bold text-white">Terminal Output</h2>
              </div>
              <div className="flex space-x-2">
                {!isConnected && (
                  <select
                    value={baudRate.toString()}
                    onChange={(e) => useSerialStore.setState({ baudRate: parseInt(e.target.value) })}
                    className="px-3 py-1.5 rounded-md bg-gray-700 text-gray-300 text-xs font-semibold mr-2"
                  >
                    {["9600", "19200", "38400", "57600", "115200"].map(rate => (
                      <option key={rate} value={rate}>{rate} baud</option>
                    ))}
                  </select>
                )}
                {isConnected && (
                  <div className="flex mr-2">
                    <button
                      onClick={() => setInputMode('direct')}
                      className={`px-3 py-1.5 rounded-l-md text-white font-semibold text-xs ${inputMode === 'direct' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                      title="Direct mode: Send characters as you type"
                    >
                      Direct
                    </button>
                    <button
                      onClick={() => setInputMode('command')}
                      className={`px-3 py-1.5 rounded-r-md text-white font-semibold text-xs ${inputMode === 'command' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                      title="Command mode: Type full commands and press Enter"
                    >
                      Command
                    </button>
                  </div>
                )}
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-semibold text-xs flex items-center"
                  title="Clear terminal contents"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Terminal
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-semibold text-xs flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            <div className="flex-1 mb-2">
              <div 
                ref={terminalRef}
                className="p-3 rounded-md font-mono text-sm overflow-y-auto" 
                style={{ 
                  backgroundColor: "#0F172A", 
                  color: "#4ADE80", 
                  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                  whiteSpace: "pre-wrap",
                  height: "530px"
                }}
                onScroll={handleTerminalScroll}
              >
                {renderTerminalContent()}
              </div>
            </div>

            <div className="h-10">
              <div className="flex items-center h-full">
                <div className="text-green-500 mr-2 font-mono">{'>'}</div>
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={!isConnected || status !== 'idle'}
                  className="flex-1 px-3 py-1.5 border bg-gray-800 text-white border-gray-700 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isConnected 
                    ? (inputMode === 'direct' 
                        ? "Type to send characters directly..." 
                        : "Type AT command and press Enter...")
                    : "Connect to start sending commands..."
                  }
                  style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                />
                {inputMode === 'command' && (
                  <button
                    onClick={() => {
                      if (inputText.trim()) {
                        sendFullCommand(inputText);
                        setInputText('');
                      }
                    }}
                    disabled={!isConnected || status !== 'idle' || !inputText.trim()}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:bg-blue-600 disabled:text-white disabled:opacity-50 font-bold flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Additional Cards */}
        <div className="w-full md:w-2/5 h-full flex flex-col">
          {/* All cards in a container with exact same height as left column */}
          <div className="h-full flex flex-col justify-between space-y-6">
            {/* Top card - Quick Commands */}
            <div className="p-4 rounded-lg shadow-md text-white" style={{ backgroundColor: "#1E293B" }}>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Commands
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {quickCommands.map((cmd, index) => (
                  <button
                    key={index}
                    onClick={() => sendQuickCommand(cmd.command)}
                    disabled={!isConnected || status !== 'idle'}
                    className="p-2 bg-gray-700 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-sm font-bold transition-colors flex items-center justify-center"
                  >
                    <span>{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Middle card - Command History */}
            <div className="p-4 rounded-lg shadow-md text-white flex flex-col" style={{ backgroundColor: "#1E293B", height: "320px" }}>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center justify-between">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Command History
                </div>
                <button
                  onClick={handleClearHistory}
                  className="px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white font-semibold text-xs flex items-center"
                  title="Clear command history"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </h2>
              <div 
                style={{ 
                  height: "calc(100% - 40px)", 
                  overflow: "auto",
                  scrollbarWidth: "thin"
                }}
              >
                {commandHistory.length === 0 ? (
                  <div className="text-sm text-gray-400 italic flex items-center justify-center h-full">
                    No commands sent yet
                  </div>
                ) : (
                  <div>
                    {commandHistory.map((cmd, index) => (
                      <div 
                        key={index} 
                        className="flex items-center p-2 hover:bg-gray-700 rounded-md group mb-1"
                        style={{ minHeight: "32px" }}
                      >
                        <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
                          <div 
                            className="text-sm text-blue-400 font-mono truncate" 
                            title={cmd}
                            style={{ maxWidth: "100%" }}
                          >
                            {cmd}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <button
                            onClick={() => resendCommand(cmd)}
                            disabled={!isConnected}
                            className="ml-2 p-1.5 bg-gray-600 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-xs flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Bottom card - Device Status */}
            <div className="p-4 rounded-lg shadow-md text-white" style={{ backgroundColor: "#1E293B" }}>
              <h2 className="text-lg font-bold text-white mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Device Status
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-gray-700 rounded-md flex flex-col">
                  <span className="text-xs text-gray-400">Baud Rate</span>
                  <span className="text-sm text-white font-bold">{deviceInfo.baudRate}</span>
                </div>
                <div className="p-2 bg-gray-700 rounded-md flex flex-col">
                  <span className="text-xs text-gray-400">Data Bits</span>
                  <span className="text-sm text-white font-bold">{deviceInfo.dataBits}</span>
                </div>
                <div className="p-2 bg-gray-700 rounded-md flex flex-col">
                  <span className="text-xs text-gray-400">Status</span>
                  <span className="text-sm text-white font-bold">{deviceInfo.status}</span>
                </div>
                <div className="p-2 bg-gray-700 rounded-md flex flex-col">
                  <span className="text-xs text-gray-400">Connection</span>
                  <span className={`text-sm font-bold flex items-center ${isConnected ? "text-green-500" : "text-red-500"}`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></span>
                    {isConnected ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 