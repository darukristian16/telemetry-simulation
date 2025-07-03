"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { EnhancedTerminal } from "@/components/enhanced-terminal"
import { useTelemetry } from "@/context/TelemetryContext"
import { SerialTelemetryBridge } from "@/components/SerialTelemetryBridge"
import { TerminalApiBridge } from "@/components/TerminalApiBridge"
import { Button } from "@/components/ui/button"
import { Play, Square } from "lucide-react"
import { useSerialStore, getSessionState } from "@/lib/store"
import {
  FullPageContent,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Page() {
  const { isSimulating, startSimulation, stopSimulation, telemetryData } = useTelemetry();
  const { isConnected: terminalConnected } = useSerialStore();
  

  const sendTelemetryData = async () => {
    if (!telemetryData) {
      alert('No telemetry data available. Please start simulation first.');
      return;
    }
    
    const sessionState = getSessionState();
    const port = sessionState.port;
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
          </div>
        </div>
      </SidebarProvider>
    </FullPageContent>
    </>
  );
}
