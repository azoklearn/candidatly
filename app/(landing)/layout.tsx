import type { ReactNode } from "react";

import "./landing.css";

/**
 * Public landing page (docs/QUESTIONS.md C77). Its stylesheet is scoped under `.lp`, so
 * it cannot leak into the application. Fonts come from the root layout (app/fonts.ts).
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="lp">{children}</div>;
}
