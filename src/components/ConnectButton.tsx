"use client";

import { useConnect, useConnectors } from "wagmi";
import Button from "@/components/Button";

// We only support MetaMask. EIP-6963 announces each installed wallet with a
// stable RDNS id, so we can pick MetaMask specifically even if another wallet
// extension is still enabled.
function isMetaMask(c: { id: string; name: string }) {
  return c.id === "io.metamask" || c.name.toLowerCase().includes("metamask");
}

export default function ConnectButton() {
  const connect = useConnect();
  const connectors = useConnectors();

  const metaMask = connectors.find(isMetaMask);

  if (!metaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="text-sm underline opacity-80 hover:opacity-100"
      >
        MetaMask not detected — install it to continue
      </a>
    );
  }

  return (
    <Button onClick={() => connect.mutate({ connector: metaMask })}>
      Connect with MetaMask
    </Button>
  );
}
