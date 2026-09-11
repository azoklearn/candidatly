import { cn } from "cn";
import type { ReactNode } from "react";

/** Exactly three messages: the CSS animation (app/globals.css) is timed for three. */
export type LoadingMessageList = readonly [string, string, string];

/** Three short messages that take turns, so a wait reads as progress. */
export function LoadingMessages({
  messages,
  className,
}: {
  messages: LoadingMessageList;
  className?: string;
}) {
  return (
    <>
      <span className="sr-only">{messages[0]}</span>
      <span aria-hidden className={cn("loader-messages", className)}>
        {messages.map((message) => (
          <span key={message}>{message}</span>
        ))}
      </span>
    </>
  );
}

/** Branded waiting screen: spinning mark, rotating messages and a progress bar. */
export function LoadingScreen({
  title,
  messages,
  className,
}: {
  title: ReactNode;
  messages: LoadingMessageList;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("fade-up grid justify-items-center gap-5 py-16 text-center", className)}
    >
      <div className="loader-orbit" aria-hidden>
        <span className="brand-mark">C</span>
      </div>
      <div className="grid gap-2">
        <p className="section-title">{title}</p>
        <LoadingMessages messages={messages} className="text-sm text-muted-foreground" />
      </div>
      <div className="loader-bar" aria-hidden />
    </div>
  );
}
