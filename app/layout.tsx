import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelDex",
  description: "Local-first asset explorer",
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
