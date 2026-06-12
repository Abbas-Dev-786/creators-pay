"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { ReactNode } from "react";
import { metaMask } from "wagmi/connectors";
import { APP_CHAIN } from "@/lib/config";

export const connectors = [metaMask()];

const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [APP_CHAIN],
  connectors,
  multiInjectedProviderDiscovery: false,
  transports: {
    [APP_CHAIN.id]: http(),
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
