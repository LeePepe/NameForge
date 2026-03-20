import { describe, it, expect } from "vitest";
import { mergeSeenNames } from "./nameHistory";

describe("mergeSeenNames", () => {
  it("adds new names while preserving order and skipping case-insensitive duplicates", () => {
    expect(
      mergeSeenNames(["Notiv"], ["Memox", "notiv", "ProjectMint"])
    ).toEqual(["Notiv", "Memox", "ProjectMint"]);
  });
});
