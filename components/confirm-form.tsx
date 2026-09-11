"use client";

import type { ReactNode } from "react";

/** Form whose server action runs only after the student confirms in a dialog. */
export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: () => void | Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
