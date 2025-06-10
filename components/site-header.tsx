"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { useSession } from "next-auth/react"

export function SiteHeader() {
  const { data: session } = useSession()
  
  const userData = {
    name: session?.user?.name || session?.user?.email || "Guest",
    avatar: session?.user?.image || "",
  }
  
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-gray-700 bg-[#1F2937] text-white font-[Roboto] font-bold transition-[width,height] ease-linear w-full left-0 fixed top-0 z-20">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 hover:bg-[#374151] hover:text-white [&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[2.5px]" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-bold">UAV Telemetry System</h1>
        <div className="ml-auto flex items-center gap-2">
          <NavUser user={userData} />
        </div>
      </div>
    </header>
  )
}
