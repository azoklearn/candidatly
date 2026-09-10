"use client";

import { useTransition, type ReactNode } from "react";

/**
 * Form that calls a useActionState dispatcher without React's automatic reset,
 * so what the student typed stays in place when the server returns an error.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();
  return (
    <form
      className={className}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {children}
    </form>
  );
}
