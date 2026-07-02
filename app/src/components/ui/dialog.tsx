"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const Dialog = DialogPrimitive.Root

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[var(--z-dialog)] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** Width/style presets for `DialogContent`:
 *  - `sm` — the compact notice card (icon/title/copy/one button; the old
 *    SmallDialog look): narrow, extra-rounded, centered text, card surface.
 *  - `default` — the standard editor dialog (max-w-lg).
 *  - `xl` — the large editor sheet (Settings, Diagnostics; the old Modal
 *    width): ≤760px wide, consumers add their own height/flex classes. */
const dialogContentSizes = {
  sm: "block max-w-xs rounded-2xl bg-card p-6 text-center shadow-panel",
  default: "",
  xl: "max-w-[760px]",
} as const

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof dialogContentSizes
  /** Extra classes for the backdrop (e.g. a z-index or blur override). */
  overlayClassName?: string
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, overlayClassName, size = "default", children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      // Don't auto-focus (and ring) the first button when the dialog opens —
      // the focus moves into the dialog container instead, so it still traps
      // focus for keyboard users without the on-open accent ring.
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "fixed left-[50%] top-[50%] z-[var(--z-dialog)] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden rounded-xl border border-border bg-bg-secondary p-0 text-text-primary shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        dialogContentSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

// Header bar: title (+ optional subtitle) on the left, a boxed close on the
// right, with a divider under it. The close lives here so every dialog gets a
// consistent header without each one rendering its own X.
const DialogHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 border-b border-border px-5 py-3",
      className
    )}
    {...props}
  >
    <div className="flex min-w-0 flex-col gap-1 text-left">{children}</div>
    <DialogPrimitive.Close asChild>
      <Button size="tiny" className="shrink-0" aria-label="Close">
        <X className="h-4 w-4" />
      </Button>
    </DialogPrimitive.Close>
  </div>
)
DialogHeader.displayName = "DialogHeader"

// Middle content (description, form controls). Sits between the header and the
// footer with its own padding.
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-4", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 border-t border-border px-5 py-3.5 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-text-muted", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
