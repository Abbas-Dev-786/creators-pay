import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      '@base-org/account': false,
      '@coinbase/wallet-sdk': false,
      'porto/internal': false,
      'porto': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      '@walletconnect/ethereum-provider': false,
    };
    return config;
  },
};

export default nextConfig;
