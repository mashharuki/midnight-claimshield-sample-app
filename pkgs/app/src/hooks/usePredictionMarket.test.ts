import { describe, expect, it } from "vitest";
import { participantStake } from "./usePredictionMarket";

describe("participantStake", () => {
  it("reads an iterable Compact map without requiring Map.entries()", () => {
    const participantKey = Uint8Array.of(0xab, 0xcd);
    const stakes = {
      [Symbol.iterator]: function* () {
        yield [participantKey, 400n] as const;
      },
    };

    expect(participantStake(stakes, "abcd")).toBe(400n);
  });
});
