"use client"

import * as React from "react"
import {
  IconBrandTablerFilled,
  IconGraphFilled,
  IconLayoutDashboardFilled,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const data = {  
  navMain: [
    {
      title: "Dashboard",
      url: "dashboard",
      icon: IconLayoutDashboardFilled,
    },
    {
      title: "Configuration",
      url: "configuration",
      icon: IconAdjustmentsHorizontal,
    },
    {
      title: "Terminal",
      url: "terminal",
      icon: IconBrandTablerFilled,
    },
    {
      title: "Telemetry",
      url: "telemetry",
      icon: IconGraphFilled,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar 
      collapsible="icon" 
      variant="app"
      className="overflow-hidden"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger 
              className="hover:bg-[#374151] hover:text-white"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
    </Sidebar>
  )
}
