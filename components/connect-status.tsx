"use client"

import React from 'react';
import { Plug } from "lucide-react";

interface ConnectStatusProps {
  isConnected: boolean;
  onConnectClick: () => void;
  error: string | null;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export const ConnectStatus: React.FC<ConnectStatusProps> = ({
  isConnected,
  onConnectClick,
  error,
  buttonProps = {}
}) => {
  return (
    <div className="bg-slate-850 border border-slate-700 rounded-md mb-4 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Plug className={`h-5 w-5 ${isConnected ? "text-emerald-500" : "text-slate-400"}`} />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"} ${isConnected ? "animate-pulse" : ""}`}></div>
          </div>
          <span className="text-sm font-medium text-slate-200">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <button
          {...buttonProps}
          onClick={onConnectClick}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150
            ${isConnected 
              ? "bg-slate-700 hover:bg-slate-600 text-slate-200" 
              : "bg-slate-700 hover:bg-slate-600 text-slate-200"}`}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      
      {error && (
        <div className="px-4 py-2 bg-rose-900/20 border-t border-rose-900/30 text-rose-200 text-xs">
          {error}
        </div>
      )}
    </div>
  );
};
