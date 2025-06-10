"use client"

import { type Icon } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  const { state } = useSidebar()
  console.log('Current pathname:', pathname)

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url
            console.log(`Item ${item.title}:`, { url: item.url, isActive })
            return (
              <SidebarMenuItem key={item.title}>
                <Link href={item.url} className="block w-full">
                  <SidebarMenuButton 
                    tooltip={item.title}
                    isActive={isActive}
                    data-active={isActive}
                    className={isActive ? "bg-[#374151] text-[hsl(var(--sidebar-accent-foreground))] font-medium hover:bg-[#374151] hover:text-[hsl(var(--sidebar-accent-foreground))]" : "hover:bg-[#374151] hover:text-[hsl(var(--sidebar-accent-foreground))]"}
                  >
                    {item.icon && <item.icon />}
                    {state !== "collapsed" && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
