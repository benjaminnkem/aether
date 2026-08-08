import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Savings · Aether external application",
  description:
    "Create and follow real Sepolia savings missions through the public Aether API.",
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
