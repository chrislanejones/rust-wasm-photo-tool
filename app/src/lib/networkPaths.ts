// The network-path registry lives at the repo root (`shared/networkPaths.ts`)
// so BOTH Vercel projects rebuild when it changes — see that file's header.
// This re-export is the only place in the app that knows the path; everything
// else imports `@/lib/networkPaths` like any other lib module.
export {
  NETWORK_PATHS,
  SWITCHED_PATHS,
  UNSWITCHED_PATHS,
  isNetworkPathAllowed,
  type NetworkGate,
  type NetworkPath,
} from "../../../shared/networkPaths";
