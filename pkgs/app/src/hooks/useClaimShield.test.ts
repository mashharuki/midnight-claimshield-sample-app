import { type ClaimantClaimProjection, ClaimStatus } from "shared";
import { describe, expect, it, vi } from "vitest";
import {
  claimShieldPersonalProjection,
  createClaimShieldProjectionSequencer,
  createClaimShieldWriteCoordinator,
  runClaimShieldWrite,
} from "./useClaimShield";

describe("ClaimShield hook boundaries", () => {
  it("returns the wallet-connect gate without executing a write", async () => {
    const requestWalletConnection = vi.fn();
    const write = vi.fn();

    await expect(
      runClaimShieldWrite({
        isConnected: false,
        isTransactionInFlight: false,
        requestWalletConnection,
        write,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { kind: "wallet", code: "walletUnavailable" },
    });

    expect(requestWalletConnection).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("does not submit a duplicate write while an operation is nonterminal", async () => {
    const write = vi.fn();

    await expect(
      runClaimShieldWrite({
        isConnected: true,
        isTransactionInFlight: true,
        requestWalletConnection: vi.fn(),
        write,
      }),
    ).resolves.toBeNull();

    expect(write).not.toHaveBeenCalled();
  });

  it("shares a same-tick write promise so a wallet request cannot be submitted twice", async () => {
    let complete: ((value: { ok: true }) => void) | undefined;
    const write = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          complete = resolve;
        }),
    );
    const coordinator = createClaimShieldWriteCoordinator();
    const options = {
      isConnected: true,
      isTransactionInFlight: false,
      requestWalletConnection: vi.fn(),
      write,
    };

    const first = coordinator.start(options);
    const second = coordinator.start(options);

    expect(second).toBe(first);
    expect(write).toHaveBeenCalledOnce();
    complete?.({ ok: true });
    await expect(first).resolves.toEqual({ ok: true });
  });

  it("releases the write guard after a typed failure so the user can retry", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: "proof", code: "submissionFailed" },
      })
      .mockResolvedValueOnce({ ok: true });
    const coordinator = createClaimShieldWriteCoordinator();
    const options = {
      isConnected: true,
      isTransactionInFlight: false,
      requestWalletConnection: vi.fn(),
      write,
    };

    await expect(coordinator.start(options)).resolves.toEqual({
      ok: false,
      error: { kind: "proof", code: "submissionFailed" },
    });
    await expect(coordinator.start(options)).resolves.toEqual({ ok: true });

    expect(write).toHaveBeenCalledTimes(2);
  });

  it("returns a recovery-only personal projection when the local payload is absent", () => {
    expect(
      claimShieldPersonalProjection({
        claimantKey: new Uint8Array(32).fill(6),
        status: ClaimStatus.approved,
        hasLocalPayload: false,
        canRedeem: false,
      }),
    ).toEqual({
      claim: {
        claimantKey: new Uint8Array(32).fill(6),
        status: ClaimStatus.approved,
        hasLocalPayload: false,
        canRedeem: false,
      },
      recoveryError: {
        kind: "privateState",
        code: "claimPayloadUnavailable",
      },
    });
  });

  it("does not let a stale personal projection overwrite a newer ledger update", async () => {
    let resolveOlder: ((value: ClaimantClaimProjection) => void) | undefined;
    let resolveNewer: ((value: ClaimantClaimProjection) => void) | undefined;
    const older = new Promise<ClaimantClaimProjection>((resolve) => {
      resolveOlder = resolve;
    });
    const newer = new Promise<ClaimantClaimProjection>((resolve) => {
      resolveNewer = resolve;
    });
    const apply = vi.fn();
    const sequencer = createClaimShieldProjectionSequencer({
      apply,
      fail: vi.fn(),
    });

    sequencer.refresh(() => older);
    sequencer.refresh(() => newer);
    resolveNewer?.({
      claimantKey: new Uint8Array(32).fill(6),
      status: ClaimStatus.redeemed,
      hasLocalPayload: true,
      canRedeem: false,
    });
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));

    resolveOlder?.({
      claimantKey: new Uint8Array(32).fill(6),
      status: ClaimStatus.approved,
      hasLocalPayload: true,
      canRedeem: true,
    });
    await Promise.resolve();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith({
      claimantKey: new Uint8Array(32).fill(6),
      status: ClaimStatus.redeemed,
      hasLocalPayload: true,
      canRedeem: false,
    });
  });

  it("does not apply a pending personal claim after its network or contract scope changes", async () => {
    let resolveClaim:
      | ((value: ClaimantClaimProjection | null) => void)
      | undefined;
    const pendingClaim = new Promise<ClaimantClaimProjection | null>(
      (resolve) => {
        resolveClaim = resolve;
      },
    );
    const apply = vi.fn();
    const sequencer = createClaimShieldProjectionSequencer({
      apply,
      fail: vi.fn(),
    });

    sequencer.refresh(() => pendingClaim);
    sequencer.invalidate();
    resolveClaim?.({
      claimantKey: new Uint8Array(32).fill(8),
      status: ClaimStatus.approved,
      hasLocalPayload: true,
      canRedeem: true,
    });
    await Promise.resolve();

    expect(apply).not.toHaveBeenCalled();
  });
});
