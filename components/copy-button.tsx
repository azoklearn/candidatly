"use client";

import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  label,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      {...props}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Copié" : label}
    </Button>
  );
}
