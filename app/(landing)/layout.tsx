import { DM_Mono, DM_Sans, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";

import "./landing.css";

// Fonts of the owner's mock-up, self-hosted by next/font (no request to Google at runtime).
const sans = DM_Sans({ subsets: ["latin"], axes: ["opsz"], variable: "--lp-font-sans" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--lp-font-mono" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--lp-font-serif",
});

/**
 * Public landing page (docs/QUESTIONS.md C77). Its stylesheet is scoped under `.lp`, so
 * it cannot leak into the application, which keeps Tailwind and shadcn/ui.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className={`lp ${sans.variable} ${mono.variable} ${serif.variable}`}>{children}</div>;
}
