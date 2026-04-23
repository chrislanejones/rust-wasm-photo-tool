import { useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../.convex/_generated/api";
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
  const { isSignedIn } = useUser();

  const convexTexts = useQuery(
    api.textHistory.getRecentTexts,
    isSignedIn ? {} : "skip",
  );

  const addRecentTextMutation = useMutation(api.textHistory.addRecentText);

  const [localTexts, setLocalTexts] = useState<TextMemory[]>(() => lsLoad());

  const recentTexts: TextMemory[] = isSignedIn
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
      if (isSignedIn) {
        await addRecentTextMutation({
          text: memory.text,
          fontSize: memory.fontSize,
          fontFamily: memory.fontFamily ?? "sans-serif",
          fontWeight: memory.fontWeight,
          textColor: memory.textColor,
        });
      } else {
        const m = { ...memory, id: _idCounter++ };
        setLocalTexts((prev) => {
          const next = [m, ...prev.filter((t) => t.text !== memory.text)].slice(0, 8);
          lsSave(next);
          return next;
        });
      }
    },
    [isSignedIn, addRecentTextMutation],
  );

  return { recentTexts, addRecentText };
}
