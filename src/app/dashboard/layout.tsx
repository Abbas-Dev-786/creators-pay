import { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-2 mb-6 md:hidden">
        <SidebarTrigger />
        <h1 className="text-xl font-bold tracking-tight">Creator Dashboard</h1>
      </div>
      <main className="max-w-6xl mx-auto pb-16">
        {children}
      </main>
    </div>
  );
}
