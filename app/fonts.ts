import { Bricolage_Grotesque, DM_Mono, Figtree, Fraunces } from "next/font/google";

// A warm, study-desk voice (C107): a characterful grotesque for the titles, a soft italic
// serif for the accent words, a friendly sans for reading. Self-hosted by next/font (no
// request to Google at runtime).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-display",
});
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });
const accent = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-accent",
});

/** Classes that define the font variables, for the root element. */
export const fontVariables = `${display.variable} ${body.variable} ${mono.variable} ${accent.variable}`;
