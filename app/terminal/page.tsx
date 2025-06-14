"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { EnhancedTerminal } from "@/components/enhanced-terminal"
import { useTelemetry } from "@/context/TelemetryContext"
import { SerialTelemetryBridge } from "@/components/SerialTelemetryBridge"
import { Button } from "@/components/ui/button"
import { Play, Square } from "lucide-react"
import { useSerialStore } from "@/lib/store"
import {
  FullPageContent,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Page() {
  const { isSimulating, startSimulation, stopSimulation, telemetryData } = useTelemetry();
  const { isConnected: terminalConnected, port } = useSerialStore();
  

  const sendTelemetryData = async () => {
    if (!telemetryData) {
      alert('No telemetry data available. Please start simulation first.');
      return;
    }
    
    if (!port || !port.writable) {
      alert('Serial port not available or not writable. Please connect first.');
      return;
    }
  };

  return (
    <>
      <SerialTelemetryBridge />
      <FullPageContent>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 48)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <SiteHeader />
          <AppSidebar variant="inset" />
          <div style={{ 
            marginLeft: 0, 
            marginTop: "var(--header-height)",
            padding: "1.5rem",
            flex: "1 1 auto",
            overflow: "auto",
            backgroundColor: "#0F172A",
            display: "flex",
            flexDirection: "column",
            width: "100%"
          }}>
            <div className="flex flex-1 flex-col space-y-4">
              <div className="flex-1">
                <EnhancedTerminal />
              </div>
              
              {/* Control Panel - simulation and serial transmission */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Control Panel</h3>

                <div className="flex items-center space-x-4 flex-wrap gap-4">
                  {/* Simulation Control */}
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={isSimulating ? stopSimulation : startSimulation}
                      disabled={!isSimulating && (!terminalConnected || !port || (!port.readable && !port.writable))}
                      variant={isSimulating ? "destructive" : "default"}
                      className="min-w-32"
                    >
                      {isSimulating ? (
                        <>
                          <Square className="mr-2 h-4 w-4" />
                          Stop Simulation
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Start Simulation
                        </>
                      )}
                    </Button>
                    
                    <div className="text-sm text-slate-400">
                      Simulation: <span className={isSimulating ? "text-green-400" : "text-slate-400"}>
                        {isSimulating ? "Running" : "Stopped"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarProvider>
      </FullPageContent>
    </>
  );
}
