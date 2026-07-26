import { describe, expect, it } from "vitest";
import {
  type ClaimShieldPrivateState,
  claimShieldWitnesses,
  createInitialClaimShieldPrivateState,
} from "./claimshield-witnesses.js";

const applicantContext = (privateState: ClaimShieldPrivateState) =>
  ({ privateState }) as Parameters<
    typeof claimShieldWitnesses.local_secret_key
  >[0];

const applicantOnePayload = {
  amount: 1_250n,
  merchantDigest: new Uint8Array(32).fill(0x11),
  evidenceDigest: new Uint8Array(32).fill(0x22),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(0x33),
  salt: new Uint8Array(32).fill(0x44),
};

const applicantTwoPayload = {
  amount: 3_400n,
  merchantDigest: new Uint8Array(32).fill(0x55),
  evidenceDigest: new Uint8Array(32).fill(0x66),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(0x77),
  salt: new Uint8Array(32).fill(0x88),
};

describe("ClaimShield claim witnesses", () => {
  it("starts without a claim payload and rejects payload reads", () => {
    const privateState = createInitialClaimShieldPrivateState(
      new Uint8Array(32).fill(1),
    );

    expect(privateState.claim).toBeNull();
    expect(() =>
      claimShieldWitnesses.get_claim_amount(applicantContext(privateState)),
    ).toThrow("Claim private payload is unavailable");
  });

  it("persists every private input for a later submission or redemption", () => {
    const originalPrivateState = createInitialClaimShieldPrivateState(
      new Uint8Array(32).fill(1),
    );
    const [storedPrivateState, storeResult] = claimShieldWitnesses.store_claim(
      applicantContext(originalPrivateState),
      applicantOnePayload.amount,
      applicantOnePayload.merchantDigest,
      applicantOnePayload.evidenceDigest,
      applicantOnePayload.opaqueReceiptIdentifier,
      applicantOnePayload.salt,
    );
    const context = applicantContext(storedPrivateState);

    expect(storeResult).toEqual([]);
    expect(originalPrivateState.claim).toBeNull();
    expect(storedPrivateState.claim).toEqual(applicantOnePayload);
    expect(claimShieldWitnesses.get_claim_amount(context)).toEqual([
      storedPrivateState,
      applicantOnePayload.amount,
    ]);
    expect(claimShieldWitnesses.get_merchant_digest(context)).toEqual([
      storedPrivateState,
      applicantOnePayload.merchantDigest,
    ]);
    expect(claimShieldWitnesses.get_evidence_digest(context)).toEqual([
      storedPrivateState,
      applicantOnePayload.evidenceDigest,
    ]);
    expect(claimShieldWitnesses.get_opaque_receipt_identifier(context)).toEqual(
      [storedPrivateState, applicantOnePayload.opaqueReceiptIdentifier],
    );
    expect(claimShieldWitnesses.get_claim_salt(context)).toEqual([
      storedPrivateState,
      applicantOnePayload.salt,
    ]);
  });

  it("stores defensive copies of mutable private byte inputs", () => {
    const merchantDigest = new Uint8Array(32).fill(0x11);
    const evidenceDigest = new Uint8Array(32).fill(0x22);
    const opaqueReceiptIdentifier = new Uint8Array(32).fill(0x33);
    const salt = new Uint8Array(32).fill(0x44);
    const [storedPrivateState] = claimShieldWitnesses.store_claim(
      applicantContext(createInitialClaimShieldPrivateState()),
      1_250n,
      merchantDigest,
      evidenceDigest,
      opaqueReceiptIdentifier,
      salt,
    );

    merchantDigest.fill(0);
    evidenceDigest.fill(0);
    opaqueReceiptIdentifier.fill(0);
    salt.fill(0);

    expect(storedPrivateState.claim).toEqual(applicantOnePayload);
  });

  it("keeps independent applicants' private payloads isolated", () => {
    const applicantOne = createInitialClaimShieldPrivateState(
      new Uint8Array(32).fill(1),
    );
    const applicantTwo = createInitialClaimShieldPrivateState(
      new Uint8Array(32).fill(2),
    );
    const [applicantOneWithClaim] = claimShieldWitnesses.store_claim(
      applicantContext(applicantOne),
      applicantOnePayload.amount,
      applicantOnePayload.merchantDigest,
      applicantOnePayload.evidenceDigest,
      applicantOnePayload.opaqueReceiptIdentifier,
      applicantOnePayload.salt,
    );
    const [applicantTwoWithClaim] = claimShieldWitnesses.store_claim(
      applicantContext(applicantTwo),
      applicantTwoPayload.amount,
      applicantTwoPayload.merchantDigest,
      applicantTwoPayload.evidenceDigest,
      applicantTwoPayload.opaqueReceiptIdentifier,
      applicantTwoPayload.salt,
    );

    expect(
      claimShieldWitnesses.get_claim_amount(
        applicantContext(applicantOneWithClaim),
      ),
    ).toEqual([applicantOneWithClaim, applicantOnePayload.amount]);
    expect(
      claimShieldWitnesses.get_claim_amount(
        applicantContext(applicantTwoWithClaim),
      ),
    ).toEqual([applicantTwoWithClaim, applicantTwoPayload.amount]);
    expect(applicantOneWithClaim.claim).toEqual(applicantOnePayload);
    expect(applicantTwoWithClaim.claim).toEqual(applicantTwoPayload);
  });
});
