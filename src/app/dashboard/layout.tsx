import { ReactNode } from "react";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";
import { LayoutDashboard, PlusCircle, Store } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-border gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <Link href="/" className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Store className="w-6 h-6" />
            CreatorPay
          </Link>
          <Separator orientation="vertical" className="hidden sm:block h-6" />
          <nav className="flex items-center gap-6">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </Link>
            <Link 
              href="/dashboard/products/new" 
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Product
            </Link>
          </nav>
        </div>
        <div className="w-full sm:w-auto flex justify-end">
          <ConnectBar />
        </div>
      </header>
      <main className="pb-16">
        {children}
      </main>
    </div>
  );
}
