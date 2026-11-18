# ADR-105: Pairing sends photos device to device; the server only introduces the two
Date: 2026-11-17   Status: draft   Relates to: ADR-064 (Betas), ADR-101, ADR-102 (Transfer)

## Context

Ticket 242: get photos between a phone and a computer that are open at the
same time, both ways, with no account. Transfer (ADR-102) already moves
phone → computer, but it needs sign-in on both, keeps the file on the server
for up to 7 days, and goes one way. A direct WebRTC data channel needs a
server only to swap the two devices' connection details (signaling), about
3 KB per pairing, and never carries a photo. The phone must still never load
the engine (#288), and demo mode must keep working logged out.

## Decision

**1. Beside Transfer, not instead of it.** Pairing needs both devices open
and a direct path between them. Transfer works when they are not open
together and when no direct path exists. Both stay; pairing's failure screen
points signed-in Transfer users at the inbox.

**2. The secret lives in the URL fragment; the server sees its hash.** The
computer makes 128 random bits (`crypto.getRandomValues`) and shows
`<origin>/#/pair/<secret>` as a QR code (and Copy link). Browsers never send a
fragment. The phone takes it out of the address bar in `main.tsx`, before the
router, GA4's page_view and Vercel Analytics read the URL
(`features/pair/invite.ts`). The server's lookup key is SHA-256(secret).

**3. An HMAC over the handshake.** Each side sends HMAC-SHA256(secret,
`"image-horse-pair/1 <role>\n" + SDP`) with its offer or answer. The SDP
carries the DTLS fingerprint. The other side verifies before
`setRemoteDescription`; a mismatch drops the attempt with the peer closed.
So the server, which never has the secret, cannot swap in its own endpoint.
Candidates are not signed; a forged one can only fail to connect.

**4. Signaling: one Convex table, no sign-in.** `pair_sessions` {keyHash,
clientToken, offer, offerMac, answer?, answerMac?, computerCandidates,
phoneCandidates, joined, createdAt, expiresAt}. No user id, no file name, no
photo data. `convex/pairSessions.ts`: `create`, `readOffer`, `join`,
`addCandidates`, `watch`, `close`, internal `expire`. Valid 5 minutes
unjoined, 30 joined; the first `join` wins. A used, expired or wrong key all
answer the same `{ ok: false, reason: "unavailable" }` (null from queries).

**5. Caps, and what they honestly stop** (`convex/pairLimits.ts`). SDP ≤
16 KB and must start `v=0`; ≤ 40 candidates a side, ≤ 512 characters each;
≤ 20 sessions created per minute by everyone together; ≤ 3 live per client
token. Convex cannot see an IP without auth, so the client token is chosen
by the client: it stops a buggy or looping tab, **not an attacker**, who can
send a new token each time. The global 20/minute is the real bound. It caps
storage at roughly 700 rows × 72 KB ≈ 50 MB, all self-deleting, and keeps
each `create` to ≤ 24 reads. The cost: anyone can **block pairing for
everyone** by making 20 sessions a minute. They learn nothing and store no
photo. If that happens: per-IP limits in an HTTP action, or sign-in to pair.

**6. Rows delete themselves.** `create` schedules `expire` at `expiresAt`
with `ctx.scheduler.runAt`; `join` schedules another at its new
`expiresAt`, and `expire` deletes only a row that is really past its date.
Not a cron: the crons in `crons.ts` are off until Chris turns them on. The
devices also `close` the row as soon as they connect. These are rows with no
stored files, so ADR-101's dry-run rule for file cleanups does not apply.

**7. STUN, no TURN.** One public STUN server, `stun.cloudflare.com:3478`,
in the network registry (`shared/networkPaths.ts`, path `pair`) and the
privacy policy. No TURN: no relay, no credentials, no secret anywhere. If
the channel is not open 15 seconds after the phone joins, both sides say
the devices couldn't reach each other directly (offices, schools, some
carriers block it) and that nothing is relayed, with "Use the Transfer
inbox instead" for a signed-in user with the Transfer Beta.

**8. Off with the online switch.** Pairing is an `online-switch` path. With
"Everything in your browser" on (the default), both sides refuse before the
first call and say why: signaling talks to a server, and photos leave the
tab. The phone's card offers the same switch Send to computer does.
Switching it on mid-pairing closes the connection.

**9. One small dependency: `uqr` 0.1.3** (MIT, zero dependencies; a port of
Nayuki's QR generator). Only `encode` is used; the app draws the grid as
one SVG path, black on white in both themes. Its lazy chunk is 15,872 B
minified, 4,935 B gzipped, fetched only when a QR code is shown. License:
`app/public/licenses/uqr-LICENSE.txt` (new folder; the fonts' copy is the
pattern). No scanner in the app: the phone's own camera reads the code.

**10. Behind Beta `pair`** on the computer. The phone needs no Beta: opening
a pairing link is its own opt-in, and only a computer with the Beta can make
one. Mounted in `App.tsx` (`PairHost`), not AppShell; the phone card is one
line in MobileShell. The peer and data channel are in `usePairStore`, for
the photo protocol (PR 2).

## Sending (PR 2)

**11. A small protocol on the data channel** (`features/pair/photoLink.ts`,
pure, unit-tested on a fake channel). The sender's manifest goes first: its
device label and, per file, `name`, `type`, `bytes` and `sha256`. The
receiver's person answers Accept or Decline ("Android phone wants to send 4
photos (18 MB)"). Then the files, one at a time, in 16 KB messages, with the
channel's send buffer kept under 1 MB (`bufferedAmountLowThreshold` 256 KB,
`bufferedamountlow`). Either side can Cancel. A closed channel is
"Disconnected". Either way the file in flight is thrown away; files already
checked stay. The device label is a guess from the user agent ("iPhone",
"Android phone", "Computer"), kept only if it is one of ours, never stored.

**12. The receiver checks every file's SHA-256** (WebCrypto) against the
manifest before it goes anywhere. A mismatch, or a file longer or shorter
than declared, drops that file with an error; the rest go on.

**13. Limits, checked twice.** 50 MB a photo and Transfer's image types
(`features/transfer/send.ts`, reused, not copied); 50 photos a send. The
sender leaves out what breaks them and says why; the RECEIVER checks the
manifest again, because a sender can lie: over 50 is refused whole, a file
over the limits is left out with the reason. The receiving gallery's tier
limit applies: it asks only for what fits and says how many didn't.

**14. Received photos go through the normal import.** The computer: the
gallery's own funnel (`handleAddPhotos`, HEIC Beta included), the one
Transfer's Inbox uses. The phone: MobileShell's own upload, with no engine.
No new table, field or op-log change. Not one photo byte reaches Convex:
the e2e watches both devices' network during a send.

**15. Originals, not edits.** "Send to phone" sends the selected photos'
stored originals; the dialog says edits aren't included unless the photo is
exported first. "Send exported copy" is not built: export runs the engine
with per-photo format choices, so it isn't cheap to bolt on here.

## Consequences

+ Photos can move both ways with no account, and never sit on a server.
+ A compromised or curious signaling server cannot connect to either device.
+ A photo that changed on the way, or a sender that lies about sizes or
  counts, is caught by the receiver, not trusted.
- A computer receiving photos loads each into the editor as it lands (the
  normal import does that), so a 10-photo send switches the open photo 10 times.
- Anyone can deny pairing to everyone for as long as they spend 20 calls a
  minute (5). Nothing in this design can prevent that without IPs or auth.
- Some networks will never connect without TURN; those users get a clear
  failure, and Transfer only if they sign in.
- Merging this deploys a new table, six public functions and one internal one to prod
  (the `convex-deploy` job). Nothing else in Convex changes.

## Rejected

- **Short typed codes.** Guessable in the 5 minutes without a rate limit
  this design cannot have (5).
- **Secret in the path or query.** It would reach Vercel's logs and GA4.
- **A cron for expiry.** Crons are off; a scheduled job per row needs no switch.
- **TURN.** A relay with credentials, a cost, and photos passing a server.

## Open questions for Chris

1. Allow pairing with "Everything in your browser" on? (Today: no.)
2. Add a TURN relay if direct connections fail too often?
3. Remember a paired phone, so the next time needs no QR code?

## Pre-mortem

It is six months later and this was a mistake. Most likely: direct
connections fail for a large share of real phone/computer pairs (carrier
NAT, guest Wi-Fi), so the feature mostly shows its failure screen, and the
honest fix is a TURN relay, which brings back the server, a bill and a
credential this design avoided.
**Warning sign:** more "unreachable" endings than "connected" ones in the
first weeks of the Beta.
