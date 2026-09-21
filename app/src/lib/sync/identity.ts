// Two ids, and the difference between them is the whole point.
//
//   TAB id    — minted per tab, never stored. Its only job is to let a tab
//               ignore the echo of its own BroadcastChannel message.
//   DEVICE id — minted once per browser profile and kept in localStorage. It
//               is what the server records as a document's `origin`, so a
//               device can tell "I wrote this" from "my phone wrote this"
//               and the status line can say which.
//
// Neither is an identity in the security sense: both are same-origin client
// values a user can clear, and nothing is authorized by them. Auth is Clerk's
// JWT, server-side, every time.
const DEVICE_KEY = "image-horse-device-id";

function mintId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Module scope, not render: `crypto.randomUUID()` is impure and calling it
// during a render breaks the React Compiler purity rule (ADR-020). Evaluated
// once when the module is first imported, which is also what makes it stable
// across every hook and store that asks for it.
const TAB_ID = mintId("tab");

export function tabId(): string {
  return TAB_ID;
}

let cachedDeviceId: string | null = null;

/** Stable per browser profile. Falls back to a per-session id when
 *  localStorage is unavailable (private mode, blocked storage) — sync still
 *  works there, the device just looks like a new one on every load. */
export function deviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) {
      cachedDeviceId = stored;
      return stored;
    }
    const minted = mintId("dev");
    localStorage.setItem(DEVICE_KEY, minted);
    cachedDeviceId = minted;
    return minted;
  } catch {
    cachedDeviceId = mintId("dev");
    return cachedDeviceId;
  }
}
