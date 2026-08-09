"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  accent: boolean;
  phase: number;
};

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>(".campaign-hero");
    if (!canvas || !hero) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      canvas.hidden = true;
      return;
    }
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const pointer = { x: -10_000, y: -10_000, active: false };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let particles: Particle[] = [];

    const createParticles = () => {
      let seed = Math.round(width * 17 + height * 31 + 20_260_809);
      const random = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
        return seed / 4_294_967_296;
      };
      const count = coarsePointer.matches
        ? 34
        : Math.min(82, Math.round(width / 18));
      particles = Array.from({ length: count }, (_, index) => {
        const x = random() * width;
        const y = random() * height;
        return {
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (random() - 0.5) * 0.16,
          vy: (random() - 0.5) * 0.12,
          radius: index % 13 === 0 ? 2.2 : 0.7 + random() * 1.15,
          alpha: 0.24 + random() * 0.58,
          accent: index % 17 === 0,
          phase: random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      const bounds = hero.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      createParticles();
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const seconds = time * 0.001;

      particles.forEach((particle, index) => {
        particle.baseX += particle.vx;
        particle.baseY += particle.vy;
        if (particle.baseX < -20) particle.baseX = width + 20;
        if (particle.baseX > width + 20) particle.baseX = -20;
        if (particle.baseY < -20) particle.baseY = height + 20;
        if (particle.baseY > height + 20) particle.baseY = -20;

        const waveX = Math.sin(seconds * 0.42 + particle.phase) * 7;
        const waveY = Math.cos(seconds * 0.34 + particle.phase) * 5;
        let targetX = particle.baseX + waveX;
        let targetY = particle.baseY + waveY;

        if (pointer.active && !coarsePointer.matches) {
          const dx = targetX - pointer.x;
          const dy = targetY - pointer.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.max(0, 1 - distance / 155);
          if (distance > 0) {
            targetX += (dx / distance) * influence * 54;
            targetY += (dy / distance) * influence * 54;
          }
        }
        particle.x += (targetX - particle.x) * 0.075;
        particle.y += (targetY - particle.y) * 0.075;

        for (
          let nextIndex = index + 1;
          nextIndex < particles.length;
          nextIndex += 1
        ) {
          const next = particles[nextIndex];
          if (!next) continue;
          const distance = Math.hypot(particle.x - next.x, particle.y - next.y);
          if (distance > 112) continue;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(next.x, next.y);
          context.strokeStyle = `rgba(255,255,255,${(1 - distance / 112) * 0.105})`;
          context.lineWidth = 0.65;
          context.stroke();
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = particle.accent
          ? `rgba(240,163,58,${particle.alpha})`
          : `rgba(255,255,255,${particle.alpha})`;
        context.fill();
      });

      if (pointer.active && !coarsePointer.matches) {
        context.beginPath();
        context.arc(pointer.x, pointer.y, 28, 0, Math.PI * 2);
        context.strokeStyle = "rgba(255,255,255,0.18)";
        context.lineWidth = 1;
        context.stroke();
        context.beginPath();
        context.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,0.92)";
        context.fill();
      }

      animationFrame = requestAnimationFrame(draw);
    };

    const updatePointer = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };
    const deactivatePointer = () => {
      pointer.active = false;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", deactivatePointer);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      hero.removeEventListener("pointermove", updatePointer);
      hero.removeEventListener("pointerleave", deactivatePointer);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="hero-particles" aria-hidden="true" />
  );
}
