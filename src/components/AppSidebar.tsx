"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Store, 
  LayoutDashboard, 
  ShoppingBag, 
  Compass, 
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { ConnectBar } from "@/components/ConnectBar";

export function AppSidebar() {
  const pathname = usePathname();

  const mainNav = [
    {
      title: "Discover",
      url: "/",
      icon: Compass,
    },
    {
      title: "My Purchases",
      url: "/orders",
      icon: ShoppingBag,
    },
  ];

  const sellerNav = [
    {
      title: "Seller Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
          <Store className="w-6 h-6" />
          CreatorPay
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Marketplace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Creator Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sellerNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname?.startsWith(item.url)}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <ConnectBar />
      </SidebarFooter>
    </Sidebar>
  );
}
