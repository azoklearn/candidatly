"use client";

import { useTransition, type ReactNode, type Ref } from "react";

/**
 * Form that calls a useActionState dispatcher without React's automatic reset,
 * so what the student typed stays in place when the server returns an error.
 */
export function ActionForm({
  action,
  className,
  children,
  ref,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: ReactNode;
  /** Set when a step submits the form itself, for example after a click on a city. */
  ref?: Ref<HTMLFormElement>;
}) {
  const [, startTransition] = useTransition();
  return (
    <form
      ref={ref}
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
