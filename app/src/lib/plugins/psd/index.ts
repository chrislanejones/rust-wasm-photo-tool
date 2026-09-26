// The PSD format plugin's codec — what `registry.ts` loads on demand. Pure:
// bytes in, LayeredDocument out, and back. Nothing here touches the engine,
// the DOM, or React (see ../document.ts for why that is the rule).
import type { FormatCodec } from "../types";
import { readPsd } from "./read";
import { writePsd } from "./write";

export const codec: FormatCodec = {
  read: readPsd,
  write: writePsd,
};
