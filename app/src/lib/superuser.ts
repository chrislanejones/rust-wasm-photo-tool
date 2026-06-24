// Only this account sees the Super User settings tab. The tier override it
// exposes is a CLIENT-SIDE UI tool (it flips local tier gating for testing) —
// the real tier and AI access stay enforced server-side by Convex, so this is a
// convenience gate, not a security boundary.
export const ADMIN_EMAIL = "chrislanejones@gmail.com";
