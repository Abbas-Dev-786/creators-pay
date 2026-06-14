"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { ReactNode, useState } from "react";
import { APP_CHAIN } from "@/lib/config";

// EIP-6963 multi-wallet discovery. When several wallet extensions are installed
// (MetaMask, Flow, Coinbase, ...) they all fight over the legacy
// `window.ethereum`, so a hardcoded injected target can open the wrong wallet.
// Discovery announces each wallet separately by name/RDNS, so the UI can offer
// "Connect with MetaMask" specifically and the 7715 flows can grab MetaMask's
// own provider via connector.getProvider().
export const wagmiConfig = createConfig({
  chains: [APP_CHAIN],
  multiInjectedProviderDiscovery: true,
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
