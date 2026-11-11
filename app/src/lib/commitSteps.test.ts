import { describe, it, expect } from "vitest";
import { joinedSetters } from "./commitSteps";

// A fake engine with the two things joinedSetters reads: a revision that moves
// on every history change, and continue_step's flag, consumed by the next
// change (a "snap") the way the engine's `snap()` consumes it.
function fakeTool() {
  const t = {
    revision: 0,
    steps: 0,
    joinArmed: false,
    log: [] as string[],
    continue_step() {
      t.joinArmed = true;
      t.log.push("join");
    },
    undo_count: () => t.steps,
    oplog_edit_revision: () => t.revision,
    /** A change: joins the open step if armed, else pushes a new one. */
    change(name: string) {
      if (t.joinArmed) t.joinArmed = false;
      else t.steps++;
      t.revision++;
      t.log.push(name);
    },
  };
  return t;
}

describe("joinedSetters: one commit, one undo step", () => {
  it("joins every setter that changes something into the step the first call opened", async () => {
    const t = fakeTool();
    const id = await joinedSetters(t, () => (t.change("add"), 7), [
      (id) => t.change(`wrap ${id}`),
      (id) => t.change(`height ${id}`),
    ]);
    expect(id).toBe(7);
    expect(t.steps).toBe(1);
    expect(t.log).toEqual(["add", "join", "wrap 7", "join", "height 7"]);
  });

  it("never joins into a step this commit didn't open (an edit that only resized the box)", async () => {
    const t = fakeTool();
    t.change("an earlier, unrelated edit");
    // The update call changed nothing; the first setter that changes something
    // must open its OWN step, not fold into the earlier edit.
    await joinedSetters(t, () => 1, [() => undefined, () => t.change("wrap"), () => t.change("height")]);
    expect(t.steps).toBe(2);
    expect(t.log).toEqual(["an earlier, unrelated edit", "wrap", "join", "height"]);
  });

  it("falls back to undo_count when the engine has no edit revision", async () => {
    const t = fakeTool();
    const noRevision = { continue_step: t.continue_step, undo_count: t.undo_count };
    await joinedSetters(noRevision, () => t.change("add"), [() => t.change("wrap")]);
    expect(t.steps).toBe(1);
  });

  it("sends the edit in the same tick as the revision read before it", async () => {
    const t = fakeTool();
    const order: string[] = [];
    const tool = { ...t, oplog_edit_revision: () => (order.push("read"), Promise.resolve(t.revision)) };
    const done = joinedSetters(tool, () => order.push("edit"), []);
    // Nothing awaited yet: both are already sent, the read first.
    expect(order).toEqual(["read", "edit"]);
    await done;
  });

  it("sends continue_step and the setter in the same tick", async () => {
    const t = fakeTool();
    const order: string[] = [];
    let tick = 0;
    const tool = {
      ...t,
      continue_step: () => order.push(`join@${tick}`),
      oplog_edit_revision: async () => (tick++, t.revision),
    };
    await joinedSetters(tool, () => t.change("add"), [() => order.push(`set@${tick}`)]);
    expect(order).toEqual(["join@2", "set@2"]);
  });
});
