"use client";

import { useEffect } from 'react';
import { useSerialStore, globals } from '@/lib/store';

/**
 * This component is used to force reset the connection state on each page load.
 * It should be included in the app layout to ensure it runs on every page.
 * 
 * It has no visual output and only handles connection state management.
 */
export function ResetConnection() {
  const { 
    isConnected,
    resetConnection, 
    clearCommandHistoryOnStartup 
  } = useSerialStore();
  
  // Effect runs on component mount (page load)
  useEffect(() => {
    console.log('ResetConnection component mounted, resetting connection state');
    
    // Force reset connection state
    resetConnection();
    
    // Clear command history on startup
    clearCommandHistoryOnStartup();
    
    // Listen for page visibility changes to reset on tab focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, resetting connection state');
        resetConnection();
      }
    };
    
    // Listen for beforeunload to clean up on navigation
    const handleBeforeUnload = () => {
      console.log('Page is being unloaded, resetting connection state');
      resetConnection();
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clean up on component unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [resetConnection, clearCommandHistoryOnStartup]);
  
  // This component doesn't render anything
  return null;
}

export default ResetConnection; 