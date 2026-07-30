export interface ServerContractArtifact {
  contractName: string;
  abi: readonly Record<string, unknown>[];
  methodIdentifiers: Readonly<Record<string, string>>;
  deployments: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
export const arcadiaMarketArtifact: ServerContractArtifact;
export const mockOracleArtifact: ServerContractArtifact;
