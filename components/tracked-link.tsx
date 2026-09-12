"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import type { EventName, EventProperties } from "@/lib/analytics";

type TrackedLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  event: EventName;
  properties?: EventProperties;
};

/** Link that records a custom event on click (C85). External addresses open in a new tab. */
export function TrackedLink({ event, properties, href, onClick, ...rest }: TrackedLinkProps) {
  const handleClick = (click: MouseEvent<HTMLAnchorElement>) => {
    track(event, properties);
    onClick?.(click);
  };
  // tel: and mailto: open an app, not a tab; only web addresses get target="_blank".
  if (/^(tel|mailto):/.test(href)) {
    return <a href={href} onClick={handleClick} {...rest} />;
  }
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} {...rest} />
    );
  }
  return <Link href={href} onClick={handleClick} {...rest} />;
}
