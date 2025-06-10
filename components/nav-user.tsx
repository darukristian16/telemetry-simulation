"use client"

import { IconLogout, IconUserFilled } from "@tabler/icons-react"
import { signOut } from "next-auth/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center justify-center rounded hover:bg-[#374151] p-1 px-2 gap-2">
            <IconUserFilled size={32} className="text-white" />
            <span className="text-white font-medium">{user.name}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-40 rounded-lg bg-[#1F2937] border-gray-700 text-white"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuItem 
            className="flex items-center gap-2 hover:bg-[#374151] text-white focus:bg-[#374151] focus:text-white cursor-pointer"
            onClick={handleLogout}
          >
            <IconLogout className="flex-shrink-0" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
