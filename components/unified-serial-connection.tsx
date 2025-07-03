"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSerialStore, getSessionState, requestSerialPort } from '@/lib/store';
import { Wifi } from 'lucide-react';

export function UnifiedSerialConnection() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'disconnecting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const disconnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const readLoopActiveRef = useRef(false);

  // Access serial state from store
  const { 
    isConnected, 
    baudRate,
    setBaudRate,
    setConnected: setStoreConnected,
    port: serialPort,
    setTerminalContent
  } = useSerialStore();

  // Update local connected state when store changes
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected]);

  // Connection recovery system - same as EnhancedTerminal
  useEffect(() => {
    if (!hasInitializedRef.current) {
      console.log('🔍 UnifiedSerialConnection mounted, checking for existing connections...');
      
      const sessionState = getSessionState();
      const storeIsConnected = useSerialStore.getState().isConnected;
      
      console.log('Session state:', {
        hasPort: !!sessionState.port,
        isConnected: storeIsConnected,
        portReadable: !!sessionState.port?.readable,
        portWritable: !!sessionState.port?.writable
      });
      
      if (sessionState.port && (sessionState.port.readable || sessionState.port.writable)) {
        console.log('📡 Found existing open port, recovering connection...');
        
        setConnected(true);
        useSerialStore.setState({ 
          port: sessionState.port,
          isConnected: true 
        });
        
        console.log('✅ Connection recovered successfully - UI should show Connected');
      } else {
        console.log('❌ No existing connection found, ensuring clean state');
        
        setConnected(false);
        useSerialStore.setState({ isConnected: false, port: null });
      }
      
      hasInitializedRef.current = true;
    }

    return () => {
      console.log('UnifiedSerialConnection unmounting, cleaning up');
      
      readLoopActiveRef.current = false;
      
      if (readerRef.current) {
        try {
          readerRef.current.cancel().catch(() => {});
          readerRef.current.releaseLock();
        } catch (error) {
          console.log('Error releasing reader on unmount:', error);
        }
        readerRef.current = null;
      }
      
      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
        } catch (error) {
          console.log('Error releasing writer on unmount:', error);
        }
        writerRef.current = null;
      }
    };
  }, []);

  // Periodic state synchronization
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const sessionState = getSessionState();
      const storeIsConnected = useSerialStore.getState().isConnected;
      
      const actuallyConnected = sessionState.port && (sessionState.port.readable || sessionState.port.writable);
      
      if (actuallyConnected && !storeIsConnected) {
        console.log('🔄 Syncing: Port is open but store shows disconnected, fixing...');
        useSerialStore.setState({ isConnected: true, port: sessionState.port });
        setConnected(true);
      } else if (!actuallyConnected && storeIsConnected) {
        console.log('🔄 Syncing: Port is closed but store shows connected, fixing...');
        useSerialStore.setState({ isConnected: false, port: null });
        sessionState.port = null;
        setConnected(false);
      }
    }, 2000);

    return () => clearInterval(syncInterval);
  }, []);

  // Read from port (simplified version, mainly for connection validation)
  const readFromPort = async (port: any) => {
    if (!port.readable || port.readable.locked) {
      console.log('⚠️ Readable stream is not available or already locked');
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
          while (readLoopActiveRef.current) {
            const { value, done } = await reader.read();
            
            if (done) {
              console.log('Reader signaled "done"');
              break;
            }
            
            if (value) {
              const decoder = new TextDecoder('utf-8', { fatal: false });
              const text = decoder.decode(value, { stream: true });
              
              // Update terminal content in store (for terminal page to see)
              setTerminalContent(prev => {
                const needsNewline = prev.length > 0 && 
                                     !prev.endsWith('\n') && 
                                     !prev.endsWith('\r\n') && 
                                     text.trim().length > 0;
                
                return prev + (needsNewline ? '\n' : '') + text;
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
          break;
        }
        
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err: any) {
      console.error('Fatal error in read process:', err);
      setError(`Fatal read error: ${err.message || String(err)}`);
    }
  };

  // Connect function - same logic as EnhancedTerminal
  const handleConnect = async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      const port = await requestSerialPort();
      console.log('Port selected by user');
      
      // Get session state for this user
      const sessionState = getSessionState();
      
      // Check if port is already open
      if (port.readable || port.writable) {
        console.log('Port is already open, using existing connection');
        
        sessionState.port = port;
        useSerialStore.setState({ port, isConnected: true });
        setConnected(true);
        
        // Start reading if possible
        if (port.readable && !readLoopActiveRef.current) {
          readFromPort(port);
        }
        
        setStatus('idle');
        return;
      }
      
      // Open the port
      await port.open({ 
        baudRate: baudRate,
        dataBits: 8, 
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      
      console.log(`Serial port opened at ${baudRate} baud`);
      
      sessionState.port = port;
      useSerialStore.setState({ port, isConnected: true });
      setConnected(true);
      
      // Start reading
      readFromPort(port);
      
      setStatus('idle');
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(`Failed to connect: ${err.message || String(err)}`);
      setConnected(false);
      setStatus('idle');
    }
  };

  // Disconnect function
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
      
      readLoopActiveRef.current = false;
      
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
          readerRef.current.releaseLock();
        } catch (err) {
          console.warn('Error releasing reader:', err);
        }
        readerRef.current = null;
      }
      
      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
        } catch (err) {
          console.warn('Error releasing writer:', err);
        }
        writerRef.current = null;
      }
      
      const sessionState = getSessionState();
      const port = sessionState.port;
      if (port) {
        try {
          await Promise.race([
            port.close(),
            new Promise(r => setTimeout(r, 2000))
          ]);
          console.log('Port closed successfully');
        } catch (err) {
          console.warn('Error closing port:', err);
        }
      }
      
      sessionState.port = null;
      setConnected(false);
      useSerialStore.setState({ port: null, isConnected: false });
      
      console.log('Disconnect completed successfully');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError(`Failed to disconnect: ${err.message || String(err)}`);
    } finally {
      setStatus('idle');
      disconnectingRef.current = false;
    }
  };

  return (
    <div>
      {/* Connection Status - Same as Terminal */}
      <div className="bg-slate-850 border border-slate-700 rounded-md mb-4 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Wifi className={`h-5 w-5 ${connected ? "text-emerald-500" : "text-slate-400"}`} />
              <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"} ${connected ? "animate-pulse" : ""}`}></div>
            </div>
            <span className="text-sm font-medium text-slate-200">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Baud Rate Selector - Only when disconnected */}
            {!connected && (
              <select
                value={baudRate.toString()}
                onChange={(e) => setBaudRate(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-md bg-gray-700 text-gray-300 text-xs font-semibold"
                disabled={status !== 'idle'}
              >
                <option value="9600">9600 baud</option>
                <option value="19200">19200 baud</option>
                <option value="38400">38400 baud</option>
                <option value="57600">57600 baud</option>
                <option value="115200">115200 baud</option>
                <option value="230400">230400 baud</option>
              </select>
            )}
            
            {/* Connect/Disconnect Button */}
            <button
              onClick={connected ? handleDisconnect : handleConnect}
              disabled={status !== 'idle'}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
            >
              {status === 'connecting' ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1 inline-block" />
                  Connecting...
                </>
              ) : status === 'disconnecting' ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1 inline-block" />
                  Disconnecting...
                </>
              ) : (
                connected ? 'Disconnect' : 'Connect'
              )}
            </button>
          </div>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-rose-900/20 border-t border-rose-900/30 text-rose-200 text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 