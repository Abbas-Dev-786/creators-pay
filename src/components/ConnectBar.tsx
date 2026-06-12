"use client";

import { useAccount, useDisconnect } from "wagmi";
import ConnectButton from "@/components/ConnectButton";
import Button from "@/components/Button";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectBar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return <ConnectButton />;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-geist-mono opacity-80">
        {shortAddr(address)}
      </span>
      <Button onClick={() => disconnect()}>Disconnect</Button>
    </div>
  );
}
