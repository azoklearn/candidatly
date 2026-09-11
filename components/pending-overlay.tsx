"use client";

import type { ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { LoadingScreen, type LoadingMessageList } from "./loading-screen";

/**
 * Full-screen waiting screen while the enclosing form's server action runs. Rendered in
 * <body>: an animated ancestor (transform) would otherwise trap the fixed layer.
 */
export function PendingOverlay({
  title,
  messages,
}: {
  title: ReactNode;
  messages: LoadingMessageList;
}) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4 backdrop-blur-sm">
      <LoadingScreen title={title} messages={messages} />
    </div>,
    document.body,
  );
}
