"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/** Submit button that shows a pending label while its form's server action runs. */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
