export const ANVIL_CHAIN_ID = 31337 as const;
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111 as const;
export const ETHEREUM_MAINNET_CHAIN_ID = 1 as const;

export interface BrowserSafeChainMetadata {
  chainId: number;
  hexChainId: `0x${string}`;
  slug: string;
  displayName: string;
  explorerUrl: string | null;
  nativeCurrency: string;
  defaultFinalityConfirmations: number;
  testnet: boolean;
  executionEnabled: boolean;
  deploymentAllowed: boolean;
  prohibited: boolean;
}

export interface ServerChainMetadata extends BrowserSafeChainMetadata {
  rpcEnvironmentVariable: "AETHER_RPC_URL";
}

export const supportedChains = {
  anvil: {
    chainId: ANVIL_CHAIN_ID,
    hexChainId: "0x7a69",
    slug: "anvil",
    displayName: "Anvil",
    rpcEnvironmentVariable: "AETHER_RPC_URL",
    explorerUrl: null,
    nativeCurrency: "Anvil ETH",
    defaultFinalityConfirmations: 1,
    testnet: true,
    executionEnabled: true,
    deploymentAllowed: true,
    prohibited: false,
  },
  ethereumSepolia: {
    chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
    hexChainId: "0xaa36a7",
    slug: "ethereum-sepolia",
    displayName: "Ethereum Sepolia",
    rpcEnvironmentVariable: "AETHER_RPC_URL",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: "Sepolia ETH",
    defaultFinalityConfirmations: 12,
    testnet: true,
    executionEnabled: true,
    deploymentAllowed: true,
    prohibited: false,
  },
} as const satisfies Record<string, ServerChainMetadata>;

export const prohibitedChainIds = [ETHEREUM_MAINNET_CHAIN_ID] as const;
export const activeLiveChain = supportedChains.ethereumSepolia;
export const browserSafeChains: readonly BrowserSafeChainMetadata[] =
  Object.values(supportedChains).map(
    ({ rpcEnvironmentVariable, ...metadata }) => {
      void rpcEnvironmentVariable;
      return metadata;
    },
  );

export function getSupportedChain(
  chainId: number,
): ServerChainMetadata | undefined {
  return Object.values(supportedChains).find(
    (chain) => chain.chainId === chainId,
  );
}

export function isProhibitedChain(chainId: number): boolean {
  return prohibitedChainIds.some((prohibited) => prohibited === chainId);
}

export function assertLiveExecutionChain(chainId: number): void {
  if (isProhibitedChain(chainId)) {
    throw new Error(`Chain ${chainId} is prohibited.`);
  }
  if (chainId !== activeLiveChain.chainId) {
    throw new Error(
      `Live execution requires ${activeLiveChain.displayName} (${activeLiveChain.chainId}).`,
    );
  }
}
