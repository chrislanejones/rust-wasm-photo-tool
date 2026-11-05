// The Inbox's shared state (ADR-102). TransferHost, which is mounted where the
// gallery's import funnel already arrives (SubscriptionButton's `openRaster`,
// like Copy look's LookHost), registers `addPhotos` here; the gallery's Inbox
// button and the dialog read it. Nothing is added to AppShell.
import { create } from "zustand";
import type { AddPhotosResult } from "@/lib/addPhotosResult";

export type AddPhotosFn = (files: File[]) => Promise<AddPhotosResult | void>;

interface TransferState {
  /** The gallery's own import (useImageSession.handleAddPhotos), or null
   *  while no host is mounted. */
  addPhotos: AddPhotosFn | null;
  setAddPhotos: (fn: AddPhotosFn | null) => void;
  inboxOpen: boolean;
  setInboxOpen: (open: boolean) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  addPhotos: null,
  setAddPhotos: (addPhotos) => set({ addPhotos }),
  inboxOpen: false,
  setInboxOpen: (inboxOpen) => set({ inboxOpen }),
}));
