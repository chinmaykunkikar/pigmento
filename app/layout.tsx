import type { Metadata } from "next";
import { DM_Mono, Hanken_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import Providers from "./providers";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

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
    <html lang="en" className={`${hanken.variable} ${dmMono.variable}`}>
      <body className="bg-bg text-text font-sans">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
