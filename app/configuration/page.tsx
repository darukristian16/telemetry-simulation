"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  FullPageContent,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { SerialConfiguration } from "@/components/serial-configuration"
import { useSerialStore } from "@/lib/store"
import { UnifiedSerialConnection } from "@/components/unified-serial-connection"

function ConnectStatusWrapper() {
  return <UnifiedSerialConnection />;
}

export default function ConfigurationPage() {
  return (
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
        <AppSidebar variant="inset"/>
        <div style={{ 
          marginLeft: 0, 
          marginTop: "var(--header-height)",
          padding: "1.5rem",
          flex: "1 1 auto",
          overflow: "auto",
          backgroundColor: "#0F172A"
        }}>
          <>
            <ConnectStatusWrapper />
            <div className="flex flex-col gap-6 mt-6">
              <SerialConfiguration />
            </div>
          </>
        </div>
      </SidebarProvider>
    </FullPageContent>
  )
}
