import { DM_Mono, DM_Sans, Instrument_Serif } from "next/font/google";

// Fonts of the landing mock-up, shared by the whole site and self-hosted by next/font
// (no request to Google at runtime).
const dmSans = DM_Sans({ subsets: ["latin"], axes: ["opsz"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

/** Classes that define the font variables, for the root element. */
export const fontVariables = `${dmSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`;
