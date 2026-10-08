// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImageSession } from "./useImageSession";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { setEngineDocument } from "@/lib/engineDocument";
import { makeLoadQueue } from "@/hooks/engineLoadQueue";
import { useLoadedDocument } from "@/hooks/useLoadedDocument";
import { setSaveFailed, useSaveStatus } from "@/lib/saveStatus";

vi.mock("@/lib/engineGate", () => ({ engineWanted: () => true, loadEngineIfWanted: async () => {} }));
vi.mock("./useEngineGate", () => ({ useEngineWanted: () => true }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({ getOriginal: async () => null, putOriginal: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), dismiss: vi.fn(), info: vi.fn() } }));

const photo = (id: string) => ({ id, name: id, originalKey: id, thumbnail: "" });
const b = photo("B") as Parameters<ReturnType<typeof useImageSession>["handleSelectPhoto"]>[0];
const c = photo("C") as typeof b;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function setup() {
  const save = vi.fn(async () => true);
  const load = vi.fn(async (_id: string) => ({}));
  const undo = vi.fn(async () => 0);
  const stamp = {
    state: { ready: true, undoCount: 0, redoCount: 0, width: 40, height: 20 },
    toolRef: { current: { undo_count: undo } },
    serialize: makeLoadQueue(),
    restoreFromOplog: vi.fn(async () => false),
    loadFromSaved: vi.fn(async (_saved: unknown, opts: { isCurrent: () => boolean; photoId: string }) => {
      if (!opts.isCurrent()) return false;
      setEngineDocument(opts.photoId);
      useGalleryStore.getState().bumpDocumentRevision(opts.photoId);
      return true;
    }),
  };
  const props = { stamp, prefs: { canvasArtboard: false }, effectiveUserMode: "demo", savePhotoEdit: save, loadPhotoEdit: load, deletePhotoEdit: vi.fn() } as unknown as Parameters<typeof useImageSession>[0];
  const hook = renderHook(() => ({ session: useImageSession(props), doc: useLoadedDocument(stamp.state), saveStatus: useSaveStatus() }));
  return { ...hook, save, load, stamp, undo };
}
beforeEach(() => {
  setSaveFailed(false);
  useGalleryStore.setState({ activePhotoId: "A", documentPhotoId: "A", documentRevision: 0, photos: [photo("A"), b, c] as typeof b[], hasBeenModified: false, layerRevision: 0 });
  useUIStore.setState({ isImageLoading: false, photoSwitchError: null });
  setEngineDocument("A");
});
describe("requested versus loaded document", () => {
  it("a failed outgoing archive preserves its document and remains retryable", async () => {
    const h = setup();
    h.undo.mockResolvedValue(1);
    h.save.mockRejectedValueOnce(new Error("disk full"));
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.result.current.saveStatus.failed).toBe(true);
    expect(h.load).not.toHaveBeenCalled();
    expect(useGalleryStore.getState().documentPhotoId).toBe("A");
    expect(useUIStore.getState().photoSwitchError).toContain("couldn't be saved");
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.result.current.saveStatus.failed).toBe(false);
    expect(useGalleryStore.getState().documentPhotoId).toBe("B");
  });

  it("returning to the unsaved loaded document never reloads an older copy", async () => {
    const h = setup();
    h.undo.mockResolvedValue(1);
    h.save.mockRejectedValueOnce(new Error("disk full"));
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    await act(async () => { await h.result.current.session.handleSelectPhoto(photo("A") as typeof b); });
    expect(h.load).not.toHaveBeenCalled();
    expect(useGalleryStore.getState().activePhotoId).toBe("A");
    expect(h.result.current.doc).not.toBeNull();
    expect(h.result.current.saveStatus.failed).toBe(true);
  });

  it("rapid switches await the same pending save and neither loads if it fails", async () => {
    const h = setup();
    const pending = deferred<boolean>();
    h.undo.mockResolvedValue(1);
    h.save.mockReturnValue(pending.promise);
    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = h.result.current.session.handleSelectPhoto(b); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => { second = h.result.current.session.handleSelectPhoto(c); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(h.save).toHaveBeenCalledOnce();
    await act(async () => { pending.reject(new Error("disk full")); await Promise.all([first, second]); });
    expect(h.load).not.toHaveBeenCalled();
    expect(useGalleryStore.getState().documentPhotoId).toBe("A");
    expect(useGalleryStore.getState().activePhotoId).toBe("C");
    expect(h.result.current.saveStatus.failed).toBe(true);
  });

  it("a refused ownership write does not claim a failed archive was recovered", async () => {
    const h = setup();
    act(() => { setSaveFailed(true, "A", "archive"); });
    h.undo.mockResolvedValue(1);
    h.save.mockResolvedValueOnce(false);
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.result.current.saveStatus.failed).toBe(true);
  });

  it("a completed archive write clears that photo's failure", async () => {
    const h = setup();
    act(() => { setSaveFailed(true, "A", "archive"); });
    h.undo.mockResolvedValue(1);
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.result.current.saveStatus.failed).toBe(false);
  });
  it("selects B and hides A's readouts before the outgoing engine read resolves", async () => {
    const h = setup();
    const pending = deferred<number>();
    h.undo.mockReturnValueOnce(pending.promise);
    let switching!: Promise<void>;
    act(() => { switching = h.result.current.session.handleSelectPhoto(b); });
    expect(useGalleryStore.getState().activePhotoId).toBe("B");
    expect(h.result.current.doc).toBeNull();
    await act(async () => { pending.resolve(0); await switching; });
    expect(useGalleryStore.getState().documentPhotoId).toBe("B");
    expect(h.result.current.doc).not.toBeNull();
  });
  it("saves the engine's outgoing owner while B is already selected", async () => {
    const h = setup();
    h.undo.mockResolvedValue(1);
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.save).toHaveBeenCalledWith("A", h.stamp.toolRef, expect.objectContaining({ detachCloudUpload: true }));
  });
  it("drops B's delayed completion after C is requested", async () => {
    const h = setup();
    const pending = deferred<object>();
    h.load.mockImplementation(id => id === "B" ? pending.promise : Promise.resolve({}));
    let first!: Promise<void>;
    act(() => { first = h.result.current.session.handleSelectPhoto(b); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await h.result.current.session.handleSelectPhoto(c); });
    await act(async () => { pending.resolve({}); await first; });
    expect(useGalleryStore.getState().activePhotoId).toBe("C");
    expect(useGalleryStore.getState().documentPhotoId).toBe("C");
  });
  it("reports a missing original and retries the already-selected photo", async () => {
    const h = setup();
    h.load.mockResolvedValueOnce(null as unknown as object);
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(useGalleryStore.getState().activePhotoId).toBe("B");
    expect(useGalleryStore.getState().documentPhotoId).toBe("A");
    expect(useUIStore.getState().photoSwitchError).toContain("Couldn't open B");
    expect(h.result.current.doc).toBeNull();
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(useGalleryStore.getState().documentPhotoId).toBe("B");
    expect(useUIStore.getState().photoSwitchError).toBeNull();
  });
  it("reports an archive restoration that returned false instead of claiming readiness", async () => {
    const h = setup();
    h.stamp.loadFromSaved.mockResolvedValueOnce(false);
    await act(async () => { await h.result.current.session.handleSelectPhoto(b); });
    expect(h.result.current.doc).toBeNull();
    expect(useUIStore.getState().photoSwitchError).toContain("Couldn't open B");
  });
});
