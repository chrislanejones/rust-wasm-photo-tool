// The tab id: minted per tab, never stored, never sent to a server. Its only
// job is to let a tab ignore the echo of its own BroadcastChannel message.
//
// There used to be a second id here — a DEVICE id, minted once per browser
// profile, kept in localStorage and uploaded with every push as the row's
// `origin`. Nothing ever read it back, so it was a persistent per-browser
// identifier sent to a server for no feature at all. It is gone; if a feature
// ever needs to tell devices apart, it has to say so in the privacy policy
// first.
//
// Not an identity in the security sense: nothing is authorized by it. Auth is
// Clerk's JWT, server-side, every time.
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
