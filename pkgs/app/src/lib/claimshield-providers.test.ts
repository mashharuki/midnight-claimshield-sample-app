import { describe, expect, it, vi } from "vitest";
import {
  claimShieldContractAddressStorageKey,
  claimShieldPrivateStateStoreName,
  claimShieldPrivateStoragePasswordKey,
  createClaimShieldProviders,
  createClaimShieldStorageScope,
  getOrCreateClaimShieldPrivateStoragePassword,
  readRememberedClaimShieldContractAddress,
  rememberClaimShieldContractAddress,
  requireClaimShieldWalletBridge,
} from "./claimshield-providers";

describe("ClaimShield provider bridge", () => {
  const contractA =
    "0200000000000000000000000000000000000000000000000000000000000000";
  const contractB =
    "0300000000000000000000000000000000000000000000000000000000000000";

  it("uses a stable network store so the SDK can scope private state by its final contract address", () => {
    expect(claimShieldPrivateStateStoreName("preview")).not.toBe(
      claimShieldPrivateStateStoreName("preprod"),
    );
    expect(
      claimShieldPrivateStoragePasswordKey("preview", "claimant-a"),
    ).not.toBe(claimShieldPrivateStoragePasswordKey("preprod", "claimant-a"));
  });

  it("isolates the remembered contract address by network", () => {
    expect(claimShieldContractAddressStorageKey("preview")).not.toBe(
      claimShieldContractAddressStorageKey("preprod"),
    );
  });

  it("never reads a contract address from another network", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    rememberClaimShieldContractAddress("preview", contractA, storage);
    rememberClaimShieldContractAddress("preprod", contractB, storage);

    expect(readRememberedClaimShieldContractAddress("preview", storage)).toBe(
      contractA,
    );
    expect(readRememberedClaimShieldContractAddress("preprod", storage)).toBe(
      contractB,
    );
  });

  it("creates and reuses a non-public private-state password only within its scope", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const scope = createClaimShieldStorageScope("preview");

    const first = getOrCreateClaimShieldPrivateStoragePassword(
      scope,
      "claimant-a",
      storage,
    );
    const second = getOrCreateClaimShieldPrivateStoragePassword(
      scope,
      "claimant-a",
      storage,
    );

    expect(first).toMatch(/^Cs![0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(
      values.get(claimShieldPrivateStoragePasswordKey("preview", "claimant-a")),
    ).toBe(first);
  });

  it("configures all six Midnight providers for a scoped policy", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("location", { origin: "http://localhost:5173" });
    vi.stubGlobal("localStorage", storage);

    try {
      const providers = createClaimShieldProviders(
        {
          wallet: {
            balanceUnsealedTransaction: async () => ({ tx: "cafe" }),
            submitTransaction: async () => undefined,
          },
          uris: {
            indexerUri: "http://localhost:8088/api/v3/graphql",
            indexerWsUri: "ws://localhost:8088/api/v3/graphql/ws",
            proverServerUri: "http://localhost:6300",
            substrateNodeUri: "http://localhost:9944",
          },
          state: {
            address: "addr",
            coinPublicKey: "claimant-a",
            encryptionPublicKey: "encrypt-a",
            addressLegacy: "",
            coinPublicKeyLegacy: "",
            encryptionPublicKeyLegacy: "",
          },
        } as never,
        "preview",
        contractA,
      );

      expect(Object.keys(providers).sort()).toEqual([
        "midnightProvider",
        "privateStateProvider",
        "proofProvider",
        "publicDataProvider",
        "walletProvider",
        "zkConfigProvider",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts only Lace wallets with the ledger-v8 transaction bridge", async () => {
    const bridge = requireClaimShieldWalletBridge({
      balanceUnsealedTransaction: async () => ({ tx: "cafe" }),
      submitTransaction: async () => undefined,
    });

    await expect(bridge.balanceUnsealedTransaction("beef")).resolves.toEqual({
      tx: "cafe",
    });
    await expect(bridge.submitTransaction("beef")).resolves.toBeUndefined();
    expect(() => requireClaimShieldWalletBridge({})).toThrow(
      "Please update Lace Wallet to continue.",
    );
  });
});
