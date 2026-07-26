import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ClaimantClaimProjection,
  type ClaimInput,
  type ClaimOperationResult,
  type ClaimShieldLedgerState,
  type ClaimTransactionState,
  type ClaimUiError,
  isClaimTransactionInFlight,
  type PolicyInput,
} from "shared";
import { useNetwork } from "@/contexts/useNetwork";
import { useWallet } from "@/contexts/useWallet";
import {
  type ClaimShieldAdapter,
  createClaimShieldAdapter,
} from "@/lib/claimshield";
import {
  createClaimShieldProviders,
  readRememberedClaimShieldContractAddress,
  rememberClaimShieldContractAddress,
} from "@/lib/claimshield-providers";

const idleTransaction: ClaimTransactionState = {
  operation: null,
  stage: "idle",
  error: null,
};

const walletUnavailable: Readonly<{ ok: false; error: ClaimUiError }> = {
  ok: false,
  error: { kind: "wallet", code: "walletUnavailable" },
};

const invalidContractAddress: Readonly<{ ok: false; error: ClaimUiError }> = {
  ok: false,
  error: { kind: "input", code: "invalidContractAddress" },
};

export type ClaimShieldPersonalProjection = Readonly<{
  /** A public pseudonymous claimant key and status; never a private payload. */
  claim: ClaimantClaimProjection | null;
  /** Safe recovery state when a local private payload is no longer available. */
  recoveryError: ClaimUiError | null;
}>;

export type ClaimShieldHookState = Readonly<{
  isWalletConnected: boolean;
  requiresWalletConnection: boolean;
  contractAddress: ContractAddress | null;
  ledger: ClaimShieldLedgerState | null;
  personalClaim: ClaimShieldPersonalProjection;
  transaction: ClaimTransactionState;
  readError: ClaimUiError | null;
}>;

export type ClaimShieldHookActions = Readonly<{
  connectWallet(): Promise<void>;
  deployPolicy(input: PolicyInput): Promise<ClaimOperationResult | null>;
  joinPolicy(address: string): Promise<ClaimOperationResult | null>;
  submitClaim(input: ClaimInput): Promise<ClaimOperationResult | null>;
  closePolicy(): Promise<ClaimOperationResult | null>;
  approveClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult | null>;
  rejectClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult | null>;
  redeemClaim(): Promise<ClaimOperationResult | null>;
}>;

export type UseClaimShieldResult = ClaimShieldHookState &
  ClaimShieldHookActions;

type ClaimShieldWriteOptions = Readonly<{
  isConnected: boolean;
  isTransactionInFlight: boolean;
  requestWalletConnection: () => void;
  write: () => Promise<ClaimOperationResult>;
}>;

/**
 * A synchronous gate shared by every write action. It is exported for the
 * node-only test runner; the React hook adds a promise mutex for same-tick
 * clicks before state updates can render.
 */
export async function runClaimShieldWrite(
  options: ClaimShieldWriteOptions,
): Promise<ClaimOperationResult | null> {
  if (!options.isConnected) {
    options.requestWalletConnection();
    return walletUnavailable;
  }
  if (options.isTransactionInFlight) return null;
  return options.write();
}

/** Projects only safe metadata; raw local claim fields never leave the adapter. */
export function claimShieldPersonalProjection(
  claim: ClaimantClaimProjection | null,
): ClaimShieldPersonalProjection {
  return {
    claim,
    recoveryError:
      claim && !claim.hasLocalPayload
        ? { kind: "privateState", code: "claimPayloadUnavailable" }
        : null,
  };
}

export type ClaimShieldProjectionSequencer = Readonly<{
  refresh(read: () => Promise<ClaimantClaimProjection | null>): void;
  invalidate(): void;
}>;

/**
 * Serializes only the application of async personal projections. The Indexer
 * may emit a new public ledger before the previous private-state read returns;
 * an older result must never overwrite the newest public status.
 */
export function createClaimShieldProjectionSequencer(
  options: Readonly<{
    apply: (claim: ClaimantClaimProjection | null) => void;
    fail: () => void;
  }>,
): ClaimShieldProjectionSequencer {
  let newestRevision = 0;

  return {
    refresh(read) {
      const revision = newestRevision + 1;
      newestRevision = revision;
      void read()
        .then((claim) => {
          if (revision === newestRevision) options.apply(claim);
        })
        .catch(() => {
          if (revision === newestRevision) options.fail();
        });
    },
    invalidate() {
      newestRevision += 1;
    },
  };
}

const contractAddressOrNull = (value: string): ContractAddress | null => {
  try {
    assertIsContractAddress(value);
    return value;
  } catch {
    return null;
  }
};

const safeReadError = (): ClaimUiError => ({
  kind: "proof",
  code: "confirmationFailed",
});

/**
 * Connects the ClaimShield adapter to the active Lace/network scope and owns
 * UI-only state. It never reads or returns raw claim witnesses.
 */
export function useClaimShield(): UseClaimShieldResult {
  const { state: walletState, connect } = useWallet();
  const { networkId } = useNetwork();
  const connection =
    walletState.status === "connected" && walletState.networkId === networkId
      ? walletState.connection
      : null;
  const scopeVersion = useRef(0);
  const inFlightPromise = useRef<Promise<ClaimOperationResult | null> | null>(
    null,
  );
  const [adapter, setAdapter] = useState<ClaimShieldAdapter | null>(null);
  const [contractAddress, setContractAddress] =
    useState<ContractAddress | null>(null);
  const [ledger, setLedger] = useState<ClaimShieldLedgerState | null>(null);
  const [personalClaim, setPersonalClaim] =
    useState<ClaimShieldPersonalProjection>(
      claimShieldPersonalProjection(null),
    );
  const [transaction, setTransaction] =
    useState<ClaimTransactionState>(idleTransaction);
  const [readError, setReadError] = useState<ClaimUiError | null>(null);
  const [requiresWalletConnection, setRequiresWalletConnection] =
    useState(false);

  const resetScopeState = useCallback(() => {
    setAdapter(null);
    setContractAddress(null);
    setLedger(null);
    setPersonalClaim(claimShieldPersonalProjection(null));
    setTransaction(idleTransaction);
    setReadError(null);
  }, []);

  const createScopedAdapter = useCallback(
    (scope: number, address?: ContractAddress): ClaimShieldAdapter | null => {
      if (!connection) return null;
      try {
        const providers = createClaimShieldProviders(
          connection,
          networkId,
          address,
        );
        return createClaimShieldAdapter(providers, (nextTransaction) => {
          if (scope === scopeVersion.current) {
            setTransaction(nextTransaction);
          }
        });
      } catch {
        if (scope === scopeVersion.current) {
          setReadError({ kind: "wallet", code: "walletUnavailable" });
        }
        return null;
      }
    },
    [connection, networkId],
  );

  useEffect(() => {
    scopeVersion.current += 1;
    const scope = scopeVersion.current;
    resetScopeState();
    setRequiresWalletConnection(!connection);
    if (!connection) return;

    const remembered = readRememberedClaimShieldContractAddress(networkId);
    if (!remembered) {
      setAdapter(createScopedAdapter(scope));
      return;
    }

    const rememberedAddress = contractAddressOrNull(remembered);
    if (!rememberedAddress) {
      setAdapter(createScopedAdapter(scope));
      setReadError(invalidContractAddress.error);
      return;
    }

    const nextAdapter = createScopedAdapter(scope, rememberedAddress);
    if (!nextAdapter) return;
    setAdapter(nextAdapter);

    void nextAdapter.joinPolicy(rememberedAddress).then((result) => {
      if (scope !== scopeVersion.current || !result.ok) return;
      const joinedAddress = nextAdapter.getContractAddress();
      if (joinedAddress) setContractAddress(joinedAddress);
    });
  }, [connection, createScopedAdapter, networkId, resetScopeState]);

  useEffect(() => {
    if (!adapter || !contractAddress) return;
    let active = true;
    const projections = createClaimShieldProjectionSequencer({
      apply: (projection) => {
        if (active) setPersonalClaim(claimShieldPersonalProjection(projection));
      },
      fail: () => {
        if (active) {
          setPersonalClaim(claimShieldPersonalProjection(null));
          setReadError({
            kind: "privateState",
            code: "claimPayloadUnavailable",
          });
        }
      },
    });
    const subscription = adapter.subscribe(contractAddress).subscribe({
      next: (nextLedger) => {
        if (!active) return;
        setLedger(nextLedger);
        projections.refresh(() =>
          adapter.getPersonalClaimProjection(nextLedger),
        );
      },
      error: () => {
        if (active) setReadError(safeReadError());
      },
    });

    return () => {
      active = false;
      projections.invalidate();
      subscription.unsubscribe();
    };
  }, [adapter, contractAddress]);

  const requestWalletConnection = useCallback(() => {
    setRequiresWalletConnection(true);
  }, []);

  const completeWrite = useCallback((result: ClaimOperationResult) => {
    if (!result.ok && result.error.kind === "privateState") {
      setPersonalClaim((current) => ({
        ...current,
        recoveryError: result.error,
      }));
    }
    return result;
  }, []);

  const startWrite = useCallback(
    (write: () => Promise<ClaimOperationResult>) => {
      if (inFlightPromise.current) return inFlightPromise.current;

      const pending = runClaimShieldWrite({
        isConnected: connection !== null,
        isTransactionInFlight: isClaimTransactionInFlight(transaction.stage),
        requestWalletConnection,
        write: async () => completeWrite(await write()),
      });

      if (
        connection === null ||
        isClaimTransactionInFlight(transaction.stage)
      ) {
        return pending;
      }

      inFlightPromise.current = pending;
      void pending.finally(() => {
        if (inFlightPromise.current === pending) {
          inFlightPromise.current = null;
        }
      });
      return pending;
    },
    [completeWrite, connection, requestWalletConnection, transaction.stage],
  );

  const connectWallet = useCallback(async () => {
    setRequiresWalletConnection(false);
    await connect();
  }, [connect]);

  const deployPolicy = useCallback(
    (input: PolicyInput) =>
      startWrite(async () => {
        const scope = scopeVersion.current;
        const nextAdapter = createScopedAdapter(scope);
        if (!nextAdapter) return walletUnavailable;
        setAdapter(nextAdapter);
        const result = await nextAdapter.deployPolicy(input);
        const deployedAddress = nextAdapter.getContractAddress();
        if (result.ok && deployedAddress && scope === scopeVersion.current) {
          rememberClaimShieldContractAddress(networkId, deployedAddress);
          setContractAddress(deployedAddress);
        }
        return result;
      }),
    [createScopedAdapter, networkId, startWrite],
  );

  const joinPolicy = useCallback(
    (address: string) =>
      startWrite(async () => {
        const parsedAddress = contractAddressOrNull(address);
        if (!parsedAddress) {
          setTransaction({
            operation: "join",
            stage: "failed",
            error: invalidContractAddress.error,
          });
          return invalidContractAddress;
        }
        const scope = scopeVersion.current;
        const nextAdapter = createScopedAdapter(scope, parsedAddress);
        if (!nextAdapter) return walletUnavailable;
        setAdapter(nextAdapter);
        const result = await nextAdapter.joinPolicy(parsedAddress);
        const joinedAddress = nextAdapter.getContractAddress();
        if (result.ok && joinedAddress && scope === scopeVersion.current) {
          rememberClaimShieldContractAddress(networkId, joinedAddress);
          setContractAddress(joinedAddress);
        }
        return result;
      }),
    [createScopedAdapter, networkId, startWrite],
  );

  const submitClaim = useCallback(
    (input: ClaimInput) =>
      startWrite(async () =>
        adapter ? adapter.submitClaim(input) : walletUnavailable,
      ),
    [adapter, startWrite],
  );
  const closePolicy = useCallback(
    () =>
      startWrite(async () =>
        adapter ? adapter.closePolicy() : walletUnavailable,
      ),
    [adapter, startWrite],
  );
  const approveClaim = useCallback(
    (claimantKey: Uint8Array) =>
      startWrite(async () =>
        adapter ? adapter.approveClaim(claimantKey) : walletUnavailable,
      ),
    [adapter, startWrite],
  );
  const rejectClaim = useCallback(
    (claimantKey: Uint8Array) =>
      startWrite(async () =>
        adapter ? adapter.rejectClaim(claimantKey) : walletUnavailable,
      ),
    [adapter, startWrite],
  );
  const redeemClaim = useCallback(
    () =>
      startWrite(async () =>
        adapter ? adapter.redeemClaim() : walletUnavailable,
      ),
    [adapter, startWrite],
  );

  return {
    isWalletConnected: connection !== null,
    requiresWalletConnection,
    contractAddress,
    ledger,
    personalClaim,
    transaction,
    readError,
    connectWallet,
    deployPolicy,
    joinPolicy,
    submitClaim,
    closePolicy,
    approveClaim,
    rejectClaim,
    redeemClaim,
  };
}
