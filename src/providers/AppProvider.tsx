"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { ReactNode, useState } from "react";
import { metaMask } from "wagmi/connectors";
import { APP_CHAIN } from "@/lib/config";

export const connectors = [metaMask()];

export const wagmiConfig = createConfig({
  chains: [APP_CHAIN],
  connectors,
  multiInjectedProviderDiscovery: false,
  transports: {
    [APP_CHAIN.id]: http(),
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
