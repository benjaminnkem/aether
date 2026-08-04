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
    default: "Aether — Protocol state control",
    template: "%s · Aether",
  },
  description:
    "Observe protocol drift, plan safe corrections, execute through KeeperHub, and independently verify onchain state.",
  metadataBase: new URL("https://aether.local"),
  openGraph: {
    title: "Aether",
    description: "Keep protocols in their intended onchain state.",
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
