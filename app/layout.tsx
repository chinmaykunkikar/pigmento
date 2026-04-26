import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "pika · cleanup for asset folders",
    template: "%s · pika",
  },
  description:
    "Find every image in your repo. Group the duplicates. Hand the cleanup to a coding agent.",
  applicationName: "pika",
  authors: [{ name: "Pika" }],
  keywords: ["assets", "icons", "duplicates", "cleanup", "codebase", "design system"],
  openGraph: {
    title: "pika",
    description:
      "Every image in your repo, in one place. Find duplicates. Hand cleanup to an agent.",
    siteName: "pika",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "pika",
    description:
      "Every image in your repo, in one place. Find duplicates. Hand cleanup to an agent.",
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
