"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    if (reduced.matches) {
      reveals.forEach((element) => element.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );
    reveals.forEach((element) => observer.observe(element));

    let frame = 0;
    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--landing-scroll", `${window.scrollY}px`);
      });
    };
    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty(
        "--pointer-x",
        `${(event.clientX / window.innerWidth - 0.5).toFixed(3)}`,
      );
      root.style.setProperty(
        "--pointer-y",
        `${(event.clientY / window.innerHeight - 0.5).toFixed(3)}`,
      );
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  return null;
}
