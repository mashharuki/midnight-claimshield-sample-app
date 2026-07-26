import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  Transaction as LedgerTransaction,
  type TransactionId,
} from "@midnight-ntwrk/ledger-v8";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import {
  type ClaimShieldCircuits,
  ClaimShieldPrivateStateId,
  type ClaimShieldProviders,
} from "shared";
import type { NetworkId } from "@/utils/networks";
import type { WalletConnectionResult } from "@/utils/types";
import { fromHex, toHex } from "./hex";

const CLAIMSHIELD_CONTRACT_ADDRESS_STORAGE_PREFIX =
  "claimshield:contract-address";
const CLAIMSHIELD_PRIVATE_STORAGE_PASSWORD_PREFIX =
  "claimshield:private-storage-password";

type ClaimShieldStorage = Pick<Storage, "getItem" | "setItem">;

type LaceBalanceResult = Readonly<{ tx: string }>;

/**
 * This capability is provided by current Midnight Lace builds, but it is not
 * declared by dapp-connector-api v3. Keep the runtime probe at this boundary
 * so the rest of the application never calls undocumented wallet fields.
 */
type LaceLedgerV8TransactionBridge = Readonly<{
  balanceUnsealedTransaction(transaction: string): Promise<LaceBalanceResult>;
  submitTransaction(transaction: string): Promise<unknown>;
}>;

export type ClaimShieldStorageScope = Readonly<{
  networkId: NetworkId;
  contractAddress: ContractAddress;
  privateStateStoreName: string;
  contractAddressStorageKey: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function requireBrowserStorage(): ClaimShieldStorage {
  if (typeof globalThis.localStorage === "undefined") {
    throw new Error("Browser local storage is unavailable.");
  }
  return globalThis.localStorage;
}

function randomPrivateStoragePassword(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Browser cryptography is unavailable.");
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** A network keeps a separate remembered contract selection. */
export function claimShieldContractAddressStorageKey(
  networkId: NetworkId,
): string {
  return `${CLAIMSHIELD_CONTRACT_ADDRESS_STORAGE_PREFIX}:${networkId}`;
}

/**
 * The LevelDB object store name includes both public scope dimensions. The
 * provider additionally scopes by the connected account and contract address.
 */
export function claimShieldPrivateStateStoreName(
  networkId: NetworkId,
  contractAddress: ContractAddress | string,
): string {
  return `${ClaimShieldPrivateStateId}:${networkId}:${contractAddress}`;
}

/**
 * The password is random per account/network/contract scope. It is never
 * derived from wallet public material and never crosses this local boundary.
 */
export function claimShieldPrivateStoragePasswordKey(
  networkId: NetworkId,
  contractAddress: ContractAddress | string,
  accountId: string,
): string {
  return `${CLAIMSHIELD_PRIVATE_STORAGE_PASSWORD_PREFIX}:${networkId}:${contractAddress}:${accountId}`;
}

export function createClaimShieldStorageScope(
  networkId: NetworkId,
  contractAddress: ContractAddress,
): ClaimShieldStorageScope {
  return {
    networkId,
    contractAddress,
    privateStateStoreName: claimShieldPrivateStateStoreName(
      networkId,
      contractAddress,
    ),
    contractAddressStorageKey: claimShieldContractAddressStorageKey(networkId),
  };
}

export function rememberClaimShieldContractAddress(
  networkId: NetworkId,
  contractAddress: ContractAddress,
  storage: ClaimShieldStorage = requireBrowserStorage(),
): void {
  storage.setItem(
    claimShieldContractAddressStorageKey(networkId),
    contractAddress,
  );
}

export function readRememberedClaimShieldContractAddress(
  networkId: NetworkId,
  storage: ClaimShieldStorage = requireBrowserStorage(),
): string | null {
  return storage.getItem(claimShieldContractAddressStorageKey(networkId));
}

export function getOrCreateClaimShieldPrivateStoragePassword(
  scope: ClaimShieldStorageScope,
  accountId: string,
  storage: ClaimShieldStorage = requireBrowserStorage(),
): string {
  const key = claimShieldPrivateStoragePasswordKey(
    scope.networkId,
    scope.contractAddress,
    accountId,
  );
  const existingPassword = storage.getItem(key);

  if (existingPassword !== null) {
    if (existingPassword.length < 16) {
      throw new Error("Stored ClaimShield private-state password is invalid.");
    }
    return existingPassword;
  }

  const password = randomPrivateStoragePassword();
  storage.setItem(key, password);
  return password;
}

/**
 * Verifies the actual transaction bridge before a transaction is constructed.
 * This keeps a missing/newer Lace capability retryable and maps it to the
 * typed wallet-unavailable path in the adapter layer.
 */
export function requireClaimShieldWalletBridge(
  wallet: unknown,
): LaceLedgerV8TransactionBridge {
  if (
    !isRecord(wallet) ||
    typeof wallet.balanceUnsealedTransaction !== "function" ||
    typeof wallet.submitTransaction !== "function"
  ) {
    throw new Error("Please update Lace Wallet to continue.");
  }

  // dapp-connector-api v3 omits these current Lace ledger-v8 methods. The
  // capability check above is deliberately the sole local type boundary.
  return wallet as unknown as LaceLedgerV8TransactionBridge;
}

export function createClaimShieldProviders(
  connection: WalletConnectionResult,
  networkId: NetworkId,
  contractAddress: ContractAddress,
): ClaimShieldProviders {
  const { wallet, uris, state } = connection;
  const scope = createClaimShieldStorageScope(networkId, contractAddress);
  const bridge = requireClaimShieldWalletBridge(wallet);

  const walletProvider: WalletProvider = {
    getCoinPublicKey: (): CoinPublicKey => state.coinPublicKey,
    getEncryptionPublicKey: (): EncPublicKey => state.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const balanced = await bridge.balanceUnsealedTransaction(
        toHex(tx.serialize()),
      );
      if (typeof balanced.tx !== "string") {
        throw new Error("Lace returned an invalid balanced transaction.");
      }
      return LedgerTransaction.deserialize(
        "signature",
        "proof",
        "binding",
        new Uint8Array(fromHex(balanced.tx)),
      ) as FinalizedTransaction;
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      await bridge.submitTransaction(toHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  const privateStateProvider = levelPrivateStateProvider({
    privateStoragePasswordProvider: () =>
      getOrCreateClaimShieldPrivateStoragePassword(scope, state.coinPublicKey),
    accountId: state.coinPublicKey,
    privateStateStoreName: scope.privateStateStoreName,
  });
  privateStateProvider.setContractAddress(contractAddress);

  const zkConfigProvider = new FetchZkConfigProvider<ClaimShieldCircuits>(
    `${globalThis.location.origin}/managed/claimshield`,
    globalThis.fetch.bind(globalThis),
  );
  const proverServerUri =
    networkId === "undeployed"
      ? `${globalThis.location.origin}/proof-server`
      : uris.proverServerUri;

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(
      uris.indexerUri,
      uris.indexerWsUri,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proverServerUri, zkConfigProvider),
    walletProvider,
    midnightProvider,
  } as ClaimShieldProviders;
}
