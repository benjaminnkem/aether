"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { SessionActions } from "@/components/auth/session-actions";
import { ThemeToggle } from "@/components/theme-toggle";

const HeroField = dynamic(() => import("./hero-field"), { ssr: false });

export function MarketingShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || window.innerWidth < 900) return;
    let cleanup = () => {};
    void import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
      let frame = 0;
      const raf = (time: number) => {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
      cleanup = () => {
        cancelAnimationFrame(frame);
        lenis.destroy();
      };
    });
    return () => cleanup();
  }, []);
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <nav className="marketing-nav__inner" aria-label="Main navigation">
          <Link href="/" aria-label="Aether home">
            <Image
              src="/brand/aether-lockup.svg"
              alt="Aether"
              width={170}
              height={32}
              style={{ width: 170, height: 32 }}
              priority
            />
          </Link>
          <div className="marketing-nav__links">
            <Link href="/#product">Product</Link>
            <Link href="/#security">Security</Link>
            <Link href="/#how-it-works">How it works</Link>
            <ThemeToggle compact className="theme-toggle--marketing" />
            <SessionActions />
          </div>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}

export function HeroBackground() {
  return <HeroField />;
}

export function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer__row">
        <Image
          src="/brand/aether-lockup.svg"
          alt="Aether"
          width={170}
          height={32}
          style={{ width: 170, height: 32 }}
        />
        <div className="integration-strip">
          <Link href="/#product">Product</Link>
          <Link href="/#security">Security</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/login">Account</Link>
        </div>
        <span className="a-status a-status--success">
          <i /> Live providers fail closed
        </span>
      </div>
      <div className="footer-word" aria-hidden="true">
        AETHER
      </div>
    </footer>
  );
}
