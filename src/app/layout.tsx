import type { Metadata } from "next";
import { Syne, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const manrope = Manrope({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Launch Studio — Hire an AI team to launch your product",
  description:
    "One brief in, a full launch kit out — logo, hero image, landing copy, social, and a voiceover ad. A self-correcting multi-agent studio powered by GMI Cloud: one key, every model type.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${manrope.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
