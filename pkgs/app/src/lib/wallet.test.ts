import {
  APIError,
  type DAppConnectorAPI,
  type DAppConnectorWalletAPI,
  type DAppConnectorWalletState,
  ErrorCodes,
} from "@midnight-ntwrk/dapp-connector-api";
import { describe, expect, it, vi } from "vitest";
import { WALLET_UNAVAILABLE_MAX_ATTEMPTS } from "@/utils/constants";
import { NETWORKS } from "@/utils/networks";
import type { LaceV4Connector, LaceV4WalletAPI } from "@/utils/types";
import {
  classifyWalletConnectError,
  connectWithConnector,
  connectWithLaceV4,
  findLaceConnector,
  isLaceV4Connector,
  NetworkMismatchError,
  UserRejectedError,
  WalletSyncingError,
  WalletUnavailableError,
} from "./wallet";

const state: DAppConnectorWalletState = {
  address: "mn_addr_preview",
  coinPublicKey: "mn_coin_preview",
  encryptionPublicKey: "mn_enc_preview",
  addressLegacy: "",
  coinPublicKeyLegacy: "",
  encryptionPublicKeyLegacy: "",
};

function connectorFor(
  wallet: DAppConnectorWalletAPI,
  network: "preview" | "preprod" = "preview",
): DAppConnectorAPI {
  return {
    name: "Midnight Lace",
    apiVersion: "1.0.0",
    isEnabled: vi.fn().mockResolvedValue(false),
    enable: vi.fn().mockResolvedValue(wallet),
    serviceUriConfig: vi.fn().mockResolvedValue(NETWORKS[network].fallbackUris),
  };
}

describe("Lace Connector API v3 connection", () => {
  it("uses enable -> serviceUriConfig -> state and returns the public wallet state", async () => {
    const calls: string[] = [];
    const wallet: DAppConnectorWalletAPI = {
      state: vi.fn(async () => {
        calls.push("state");
        return state;
      }),
      balanceAndProveTransaction: vi.fn(),
      submitTransaction: vi.fn(),
      balanceTransaction: vi.fn(),
      proveTransaction: vi.fn(),
    };
    const connector = connectorFor(wallet);
    connector.enable = vi.fn(async () => {
      calls.push("enable");
      return wallet;
    });
    connector.serviceUriConfig = vi.fn(async () => {
      calls.push("serviceUriConfig");
      return NETWORKS.preview.fallbackUris;
    });

    await expect(
      connectWithConnector(connector, "preview"),
    ).resolves.toMatchObject({
      wallet,
      uris: NETWORKS.preview.fallbackUris,
      state,
    });
    expect(calls).toEqual(["enable", "serviceUriConfig", "state"]);
  });

  it("rejects a Lace URI configuration for a different network", async () => {
    const wallet = {
      state: vi.fn().mockResolvedValue(state),
    } as unknown as DAppConnectorWalletAPI;

    await expect(
      connectWithConnector(connectorFor(wallet, "preprod"), "preview"),
    ).rejects.toBeInstanceOf(NetworkMismatchError);
    expect(wallet.state).not.toHaveBeenCalled();
  });
});

describe("Lace v4 detection", () => {
  it("discovers a v4-only connector injected under a non-mnLace key", () => {
    const v4 = {
      apiVersion: "4.0.0",
      connect: vi.fn(),
      getConfiguration: vi.fn(),
      getShieldedAddresses: vi.fn(),
    };

    const found = findLaceConnector({ lace: v4 });
    expect(found).toBe(v4);
    expect(isLaceV4Connector(found)).toBe(true);
  });

  it("discovers an apiVersion-only provider before its optional capabilities are available", () => {
    expect(findLaceConnector({ lace: { apiVersion: "4.0.0" } })).toEqual({
      apiVersion: "4.0.0",
    });
  });

  it("connects with the v4 connector and reads addresses from the connector", async () => {
    const wallet = {} as DAppConnectorWalletAPI;
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi.fn().mockResolvedValue(wallet),
      getConfiguration: vi
        .fn()
        .mockResolvedValue(NETWORKS.preview.fallbackUris),
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: state.address,
        shieldedCoinPublicKey: state.coinPublicKey,
        shieldedEncryptionPublicKey: state.encryptionPublicKey,
      }),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).resolves.toMatchObject({
      wallet,
      uris: NETWORKS.preview.fallbackUris,
      state,
    });
    expect(connector.connect).toHaveBeenCalledWith("preview");
    expect(connector.getConfiguration).toHaveBeenCalledOnce();
    expect(connector.getShieldedAddresses).toHaveBeenCalledOnce();
  });

  it("prefers the v4 connector address API over the legacy wallet API", async () => {
    const wallet = {
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: "legacy-address",
      }),
    } as unknown as LaceV4WalletAPI;
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi.fn().mockResolvedValue(wallet),
      getConfiguration: vi
        .fn()
        .mockResolvedValue(NETWORKS.preview.fallbackUris),
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: state.address,
        shieldedCoinPublicKey: state.coinPublicKey,
        shieldedEncryptionPublicKey: state.encryptionPublicKey,
      }),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).resolves.toMatchObject({ state });
    expect(connector.getShieldedAddresses).toHaveBeenCalledOnce();
    expect(wallet.getShieldedAddresses).not.toHaveBeenCalled();
  });

  it("falls back to the legacy wallet address API", async () => {
    const wallet = {
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: state.address,
        shieldedCoinPublicKey: state.coinPublicKey,
        shieldedEncryptionPublicKey: state.encryptionPublicKey,
      }),
    } as unknown as LaceV4WalletAPI;
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi.fn().mockResolvedValue(wallet),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).resolves.toMatchObject({ state });
    expect(wallet.getShieldedAddresses).toHaveBeenCalledOnce();
  });

  it("keeps a successful v4 connection when configuration lookup is unavailable", async () => {
    const wallet = {
      getConfiguration: vi
        .fn()
        .mockRejectedValue(new Error("Wallet is unavailable")),
    } as unknown as LaceV4WalletAPI;
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi.fn().mockResolvedValue(wallet),
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: state.address,
        shieldedCoinPublicKey: state.coinPublicKey,
        shieldedEncryptionPublicKey: state.encryptionPublicKey,
      }),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).resolves.toMatchObject({
      wallet,
      uris: NETWORKS.preview.fallbackUris,
      state,
    });
  });

  it("retries reading addresses while the Lace midnight wallet is still starting", async () => {
    vi.useFakeTimers();
    try {
      const connector: LaceV4Connector = {
        apiVersion: "4.0.0",
        connect: vi.fn().mockResolvedValue({} as LaceV4WalletAPI),
        getConfiguration: vi
          .fn()
          .mockResolvedValue(NETWORKS.preview.fallbackUris),
        getShieldedAddresses: vi
          .fn()
          .mockRejectedValueOnce(
            new APIError(ErrorCodes.InternalError, "Wallet is unavailable"),
          )
          .mockRejectedValueOnce(
            new APIError(ErrorCodes.InternalError, "Wallet is unavailable"),
          )
          .mockResolvedValue({
            shieldedAddress: state.address,
            shieldedCoinPublicKey: state.coinPublicKey,
            shieldedEncryptionPublicKey: state.encryptionPublicKey,
          }),
      };

      const result = connectWithLaceV4(connector, "preview");
      const assertion = expect(result).resolves.toMatchObject({ state });
      await vi.runAllTimersAsync();
      await assertion;
      expect(connector.getShieldedAddresses).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries when the extension bridge omits the API error code", async () => {
    vi.useFakeTimers();
    try {
      const connector: LaceV4Connector = {
        apiVersion: "4.0.0",
        connect: vi.fn().mockResolvedValue({} as LaceV4WalletAPI),
        getShieldedAddresses: vi
          .fn()
          .mockRejectedValueOnce(new Error("Wallet is unavailable"))
          .mockResolvedValue({
            shieldedAddress: state.address,
            shieldedCoinPublicKey: state.coinPublicKey,
            shieldedEncryptionPublicKey: state.encryptionPublicKey,
          }),
      };

      const result = connectWithLaceV4(connector, "preview");
      const assertion = expect(result).resolves.toMatchObject({ state });
      await vi.runAllTimersAsync();
      await assertion;
      expect(connector.getShieldedAddresses).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("raises WalletUnavailableError after exhausting startup retries", async () => {
    vi.useFakeTimers();
    try {
      const connector: LaceV4Connector = {
        apiVersion: "4.0.0",
        connect: vi.fn().mockResolvedValue({} as LaceV4WalletAPI),
        getShieldedAddresses: vi
          .fn()
          .mockRejectedValue(
            new APIError(ErrorCodes.InternalError, "Wallet is unavailable"),
          ),
      };

      const result = connectWithLaceV4(connector, "preview");
      const assertion = expect(result).rejects.toBeInstanceOf(
        WalletUnavailableError,
      );
      await vi.runAllTimersAsync();
      await assertion;
      expect(connector.getShieldedAddresses).toHaveBeenCalledTimes(
        WALLET_UNAVAILABLE_MAX_ATTEMPTS,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries connect while the Lace Midnight wallet is starting", async () => {
    vi.useFakeTimers();
    try {
      const connector: LaceV4Connector = {
        apiVersion: "4.0.0",
        connect: vi
          .fn()
          .mockRejectedValueOnce(
            new APIError(ErrorCodes.InternalError, "Wallet is unavailable"),
          )
          .mockResolvedValue({} as LaceV4WalletAPI),
        getShieldedAddresses: vi.fn().mockResolvedValue({
          shieldedAddress: state.address,
          shieldedCoinPublicKey: state.coinPublicKey,
          shieldedEncryptionPublicKey: state.encryptionPublicKey,
        }),
      };

      const result = connectWithLaceV4(connector, "preview");
      const assertion = expect(result).resolves.toMatchObject({ state });
      await vi.runAllTimersAsync();
      await assertion;
      expect(connector.connect).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains an invalid Lace network selection", async () => {
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi
        .fn()
        .mockRejectedValue(
          new APIError(ErrorCodes.InternalError, "Invalid network ID"),
        ),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).rejects.toBeInstanceOf(NetworkMismatchError);
  });

  it("preserves the Lace wallet receiver when reading shielded addresses", async () => {
    const wallet = {
      getShieldedAddresses: vi.fn(function (this: unknown) {
        expect(this).toBe(wallet);
        return {
          shieldedAddress: state.address,
          shieldedCoinPublicKey: state.coinPublicKey,
          shieldedEncryptionPublicKey: state.encryptionPublicKey,
        };
      }),
    } as unknown as LaceV4WalletAPI;
    const connector: LaceV4Connector = {
      apiVersion: "4.0.0",
      connect: vi.fn().mockResolvedValue(wallet),
    };

    await expect(
      connectWithLaceV4(connector, "preview"),
    ).resolves.toMatchObject({ state });
    expect(wallet.getShieldedAddresses).toHaveBeenCalledOnce();
  });
});

describe("Lace connector error classification", () => {
  it("classifies connector rejection, sync, and preserves internal errors", () => {
    expect(
      classifyWalletConnectError(
        new APIError(ErrorCodes.Rejected, "User rejected request"),
      ),
    ).toBeInstanceOf(UserRejectedError);
    expect(
      classifyWalletConnectError(
        new APIError(ErrorCodes.InternalError, "Wallet is syncing"),
      ),
    ).toBeInstanceOf(WalletSyncingError);

    const internal = new APIError(
      ErrorCodes.InternalError,
      "Indexer is unavailable",
    );
    expect(classifyWalletConnectError(internal)).toBe(internal);
  });

  it("classifies the Lace wallet-instance-unavailable error with guidance", () => {
    expect(
      classifyWalletConnectError(
        new APIError(ErrorCodes.InternalError, "Wallet is unavailable"),
      ),
    ).toBeInstanceOf(WalletUnavailableError);
  });
});
