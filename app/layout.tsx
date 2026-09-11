import type { Metadata } from "next";

import { VercelAnalytics } from "@/components/vercel-analytics";
import { APP_NAME } from "@/lib/brand";

import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Trouvez votre alternance et envoyez des candidatures qui vous ressemblent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}
