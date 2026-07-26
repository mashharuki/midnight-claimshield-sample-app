import { describe, expect, it } from "vitest";

import {
  ClaimShield,
  claimShieldWitnesses,
  createInitialClaimShieldPrivateState,
} from "./index.js";

describe("ClaimShield contract package exports", () => {
  it("exports the generated binding and ClaimShield witness helpers", () => {
    expect(ClaimShield.Contract).toBeTypeOf("function");
    expect(claimShieldWitnesses.local_secret_key).toBeTypeOf("function");
    expect(createInitialClaimShieldPrivateState()).toEqual({
      secretKey: new Uint8Array(32),
      claim: null,
    });
  });
});
