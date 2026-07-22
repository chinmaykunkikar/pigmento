import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "pigmento · the asset manager for your codebase",
    template: "%s · pigmento",
  },
  description:
    "Map every image, color, and font in your repo. Spot the drift. Hand the cleanup to a coding agent.",
  applicationName: "pigmento",
  authors: [{ name: "Pigmento" }],
  keywords: ["assets", "icons", "duplicates", "cleanup", "codebase", "design system"],
  openGraph: {
    title: "pigmento",
    description:
      "Every image, color, and font in your repo, in one place. Spot the drift. Hand cleanup to an agent.",
    siteName: "pigmento",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "pigmento",
    description:
      "Every image, color, and font in your repo, in one place. Spot the drift. Hand cleanup to an agent.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
