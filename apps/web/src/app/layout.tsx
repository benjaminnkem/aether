import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const campaign = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-campaign",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aether — Onchain mission control",
    template: "%s · Aether",
  },
  description:
    "Durable Sepolia mission execution, independent verification, reconciliation, and recovery.",
  metadataBase: new URL("https://aether.local"),
  openGraph: {
    title: "Aether",
    description: "Know what landed. Recover what did not.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${campaign.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
