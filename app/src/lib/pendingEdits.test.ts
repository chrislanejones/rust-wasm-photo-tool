import { describe, it, expect } from "vitest";
import { commitPendingEdits, registerPendingCommit } from "./pendingEdits";

describe("pendingEdits", () => {
  it("runs every registered commit, in order, and stops after unregister", async () => {
    const ran: string[] = [];
    const offA = registerPendingCommit(async () => void ran.push("a"));
    const offB = registerPendingCommit(async () => void ran.push("b"));
    await commitPendingEdits();
    expect(ran).toEqual(["a", "b"]);
    offA();
    await commitPendingEdits();
    expect(ran).toEqual(["a", "b", "b"]);
    offB();
  });

  it("a failing commit does not stop the others or throw", async () => {
    const ran: string[] = [];
    const off1 = registerPendingCommit(async () => {
      throw new Error("x");
    });
    const off2 = registerPendingCommit(async () => void ran.push("ok"));
    await expect(commitPendingEdits()).resolves.toBeUndefined();
    expect(ran).toEqual(["ok"]);
    off1();
    off2();
  });
});
