import { useState, useCallback } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { TextMemory } from "@/features/tools/settings/TextSettings";

const LS_KEY = "image-horse-recent-texts";

function lsLoad(): TextMemory[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as TextMemory[];
  } catch {
    return [];
  }
}

function lsSave(texts: TextMemory[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(texts));
}

let _idCounter = 0;

export function useRecentTexts() {
  // useConvexAuth.isAuthenticated is true only after Convex completes the JWT
  // handshake — unlike Clerk's isSignedIn which stays true even when the
  // Convex auth provider rejects the token (e.g. dev keys vs prod deployment).
  const { isAuthenticated } = useConvexAuth();

  const convexTexts = useQuery(
    api.textHistory.getRecentTexts,
    isAuthenticated ? {} : "skip",
  );

  const addRecentTextMutation = useMutation(api.textHistory.addRecentText);

  const [localTexts, setLocalTexts] = useState<TextMemory[]>(() => lsLoad());

  const recentTexts: TextMemory[] = isAuthenticated
    ? (convexTexts ?? []).map((t, i) => ({
        id: i,
        text: t.text,
        fontSize: t.fontSize,
        fontFamily: (t as any).fontFamily ?? "sans-serif",
        fontWeight: t.fontWeight,
        textColor: t.textColor,
      }))
    : localTexts;

  const addRecentText = useCallback(
    async (memory: TextMemory) => {
      if (isAuthenticated) {
        try {
          await addRecentTextMutation({
            text: memory.text,
            fontSize: memory.fontSize,
            fontFamily: memory.fontFamily ?? "sans-serif",
            fontWeight: memory.fontWeight,
            textColor: memory.textColor,
          });
        } catch {
          // fall back to local storage if the Convex call fails
          const m = { ...memory, id: _idCounter++ };
          setLocalTexts((prev) => {
            const next = [m, ...prev.filter((t) => t.text !== memory.text)].slice(0, 8);
            lsSave(next);
            return next;
          });
        }
      } else {
        const m = { ...memory, id: _idCounter++ };
        setLocalTexts((prev) => {
          const next = [m, ...prev.filter((t) => t.text !== memory.text)].slice(0, 8);
          lsSave(next);
          return next;
        });
      }
    },
    [isAuthenticated, addRecentTextMutation],
  );

  return { recentTexts, addRecentText };
}
