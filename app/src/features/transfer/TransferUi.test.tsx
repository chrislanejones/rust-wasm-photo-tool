// @vitest-environment jsdom
//
// Transfer's two surfaces (ADR-102) with Convex mocked at lib/cloud:
//   · the phone's Send to computer — three photos, one row each, the result
//     line; the right message and NO upload when signed out or offline;
//   · the editor's Inbox — Add all runs the registered import once and
//     receives each photo; the button hides when empty and counts right.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";

const generateUploadUrl = vi.fn(async () => "https://upload.invalid/u");
const create = vi.fn(async (args: { name: string }) => ({ ok: true as const, id: `t-${args.name}`, bytes: 3, expiresAt: 0 }));
const receive = vi.fn(async () => ({ removed: true }));
const remove = vi.fn(async () => ({ removed: true }));
let authed = true;
let betaOn = true;
let inbox: { items: unknown[]; limit: number } | undefined;

vi.mock("@/lib/cloud", () => ({
  useCloudAuth: () => ({ isAuthenticated: authed, isLoading: false }),
  useCloudMutation: (ref: unknown) => {
    const name = getFunctionName(ref as never);
    return (
      { "transfers:generateUploadUrl": generateUploadUrl, "transfers:create": create, "transfers:receive": receive, "transfers:remove": remove } as Record<string, unknown>
    )[name];
  },
  useCloudQuery: (ref: unknown, args: unknown) =>
    args === "skip" ? undefined : getFunctionName(ref as never) === "transfers:listMine" ? inbox : undefined,
}));
vi.mock("@/lib/beta", () => ({
  isBetaOn: (id: string) => betaOn && id === "transfer",
  subscribeBeta: () => () => {},
}));
const manifestIds = new Set<string>();
vi.mock("@/lib/galleryManifest", () => ({
  loadGalleryManifest: async () => ({ photos: [...manifestIds].map((id) => ({ id })) }),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: Object.assign(vi.fn(), { info: vi.fn(), success: vi.fn(), error: vi.fn() }) }));

import { useUIStore } from "@/stores/useUIStore";
import { SendToComputer } from "./SendToComputer";
import { InboxButton } from "./InboxButton";
import { InboxDialog } from "./InboxDialog";
import { TransferHost } from "./TransferHost";
import { useTransferStore } from "./transferStore";

const fetchSpy = vi.fn(async (url: string) =>
  url.startsWith("https://upload")
    ? new Response(JSON.stringify({ storageId: "st" }), { status: 200 })
    : new Response(new Blob([new Uint8Array(4)], { type: "image/jpeg" }), { status: 200 }),
);

// jsdom has no IntersectionObserver; the Inbox's lazy thumbnails
// (DecodedImage → framer's useInView) ask for one. Never intersecting is fine:
// these tests read the rows, not the pictures.
class NoIntersection {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", NoIntersection);
  authed = true;
  betaOn = true;
  inbox = undefined;
  manifestIds.clear();
  for (const f of [generateUploadUrl, create, receive, remove, fetchSpy]) f.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  useUIStore.setState({ onlineFeaturesEnabled: true });
  useTransferStore.setState({ addPhotos: null, inboxOpen: false });
});
afterEach(() => vi.unstubAllGlobals());

const photos = () => [1, 2, 3].map((i) => new File([new Uint8Array(3)], `IMG_000${i}.HEIC`, { type: "image/heic" }));

describe("phone: Send to computer", () => {
  it("sends three photos, one row each, and says they wait 7 days", async () => {
    render(<SendToComputer />);
    const input = screen.getByTestId("send-to-computer-input") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: photos() } });
    });
    await waitFor(() => expect(screen.getByText("3 photos sent. They'll wait 7 days.")).toBeTruthy());
    expect(generateUploadUrl).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.map((c) => c[0].name)).toEqual(["IMG_0001.HEIC", "IMG_0002.HEIC", "IMG_0003.HEIC"]);
    const rows = within(screen.getByRole("list", { name: "Photos being sent" })).getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-send-status"))).toEqual(["sent", "sent", "sent"]);
  });

  it("a refused photo shows the server's reason on its own row", async () => {
    create.mockImplementationOnce(async () => ({ ok: false, message: "Storage full: 1 MB left, and this photo is 3 MB." }) as never);
    render(<SendToComputer />);
    await act(async () => {
      fireEvent.change(screen.getByTestId("send-to-computer-input"), { target: { files: photos().slice(0, 2) } });
    });
    await waitFor(() => expect(screen.getByText("1 of 2 sent. It'll wait 7 days.")).toBeTruthy());
    expect(screen.getByText(/Storage full: 1 MB left/)).toBeTruthy();
  });

  it("signed out: the sign-in line, no picker, nothing asked of the server", () => {
    authed = false;
    render(<SendToComputer />);
    expect(screen.getByText("Sign in to send photos to your computer.")).toBeTruthy();
    expect(screen.queryByTestId("send-to-computer-input")).toBeNull();
    expect(generateUploadUrl).not.toHaveBeenCalled();
  });

  it("online switch off: the message and this device's switch, no picker", () => {
    useUIStore.setState({ onlineFeaturesEnabled: false });
    render(<SendToComputer />);
    expect(screen.getByText("Transfer is off while everything stays in your browser.")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Online features/ })).toBeTruthy();
    expect(screen.queryByTestId("send-to-computer-input")).toBeNull();
  });

  it("Beta off: nothing at all", () => {
    betaOn = false;
    const { container } = render(<SendToComputer />);
    expect(container.innerHTML).toBe("");
  });
});

const waiting = (n: number) => ({
  limit: 50,
  items: Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `IMG_${i}.JPG`,
    mime: "image/jpeg",
    bytes: 2_000_000,
    width: null,
    height: null,
    fromDevice: "iPhone",
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86_400_000 - 1000,
    url: `https://files.invalid/t${i}`,
  })),
});

describe("editor: the Inbox", () => {
  it("Add all runs the registered import once with all three, then receives each", async () => {
    inbox = waiting(3);
    const addPhotos = vi.fn(async (files: File[]) => {
      const ids = files.map((_, i) => `g${i}`);
      ids.forEach((id) => manifestIds.add(id));
      return { outcomes: ids.map((photoId) => ({ status: "added" as const, photoId })) };
    });
    useTransferStore.setState({ inboxOpen: true });
    render(<TransferHost onAddPhotos={addPhotos} />);
    expect(screen.getAllByText(/Expires in 7 days/)).toHaveLength(3);
    expect(screen.getAllByText(/from iPhone/)).toHaveLength(3);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add all" }));
    });
    await waitFor(() => expect(receive).toHaveBeenCalledTimes(3));
    expect(addPhotos).toHaveBeenCalledTimes(1);
    expect(addPhotos.mock.calls[0]![0].map((f: File) => f.name)).toEqual(["IMG_0.JPG", "IMG_1.JPG", "IMG_2.JPG"]);
    expect(receive.mock.calls.map((c) => (c[0] as { id: string }).id)).toEqual(["t0", "t1", "t2"]);
    expect(screen.getByText("3 added to the gallery.")).toBeTruthy();
  });

  it("a failed import stays with its error; a full gallery says how many are left", async () => {
    inbox = waiting(3);
    const addPhotos = vi.fn(async () => {
      manifestIds.add("g0");
      return {
        outcomes: [
          { status: "added" as const, photoId: "g0" },
          { status: "failed" as const, message: "Couldn't open IMG_1.JPG." },
          { status: "over-limit" as const },
        ],
      };
    });
    useTransferStore.setState({ addPhotos, inboxOpen: true });
    render(<InboxDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add all" }));
    });
    await waitFor(() => expect(screen.getByText("Couldn't open IMG_1.JPG.")).toBeTruthy());
    expect(receive).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 added to the gallery. The gallery is full: 1 photo is still in the inbox.")).toBeTruthy();
  });

  it("Delete removes without importing", async () => {
    inbox = waiting(1);
    const addPhotos = vi.fn();
    useTransferStore.setState({ addPhotos, inboxOpen: true });
    render(<InboxDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete IMG_0.JPG from the inbox" }));
    });
    expect(remove).toHaveBeenCalledWith({ id: "t0" });
    expect(addPhotos).not.toHaveBeenCalled();
  });

  it("the button hides when the inbox is empty and counts right when it is not", () => {
    useTransferStore.setState({ addPhotos: vi.fn() });
    inbox = waiting(0);
    const { rerender } = render(<InboxButton />);
    expect(screen.queryByTestId("inbox-button")).toBeNull();
    inbox = waiting(4);
    rerender(<InboxButton />);
    expect(screen.getByTestId("inbox-count").textContent).toBe("4");
    expect(screen.getByRole("button", { name: "Inbox: 4 photos from your phone" })).toBeTruthy();
  });

  it("signed out or offline: no inbox query, no button", () => {
    useTransferStore.setState({ addPhotos: vi.fn() });
    inbox = waiting(2);
    authed = false;
    const { rerender } = render(<InboxButton />);
    expect(screen.queryByTestId("inbox-button")).toBeNull();
    authed = true;
    useUIStore.setState({ onlineFeaturesEnabled: false });
    rerender(<InboxButton />);
    expect(screen.queryByTestId("inbox-button")).toBeNull();
  });
});
