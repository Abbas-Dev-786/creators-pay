import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/providers/AppProvider";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorPay",
  description:
    "A decentralized Gumroad: sell digital and AI products, paid via MetaMask smart accounts with x402.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark:text-white", "font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground font-geist-sans antialiased max-w-full overflow-x-hidden`}
      >
        <AppProvider>
          <SidebarProvider>
            <AppSidebar />
            <div className="flex-1 w-full relative">
              <div className="md:hidden absolute top-4 left-4 z-50">
                <SidebarTrigger />
              </div>
              <main className="w-full min-h-screen">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </AppProvider>
      </body>
    </html>
  );
}
