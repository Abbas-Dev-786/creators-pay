import { ReactNode } from "react";
import Link from "next/link";
import { ConnectBar } from "@/components/ConnectBar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10 pb-4 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold">CreatorPay</Link>
          <nav className="hidden sm:flex gap-4">
            <Link href="/dashboard" className="text-sm font-medium opacity-80 hover:opacity-100">Overview</Link>
            <Link href="/dashboard/products/new" className="text-sm font-medium opacity-80 hover:opacity-100">New Product</Link>
          </nav>
        </div>
        <ConnectBar />
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
