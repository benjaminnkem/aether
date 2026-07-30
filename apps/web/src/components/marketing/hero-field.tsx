"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroField() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = mount.current;
    if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.innerWidth < 720) return;
    let frame = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, target.clientWidth / target.clientHeight, 0.1, 100);
    camera.position.z = 12;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(target.clientWidth, target.clientHeight);
    target.appendChild(renderer.domElement);
    const count = 74;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.sin(index * 91.17) * 0.5 + 0.5) * 18 - 9;
      positions[index * 3 + 1] = (Math.sin(index * 47.73) * 0.5 + 0.5) * 9 - 4.5;
      positions[index * 3 + 2] = (Math.sin(index * 13.41) * 0.5 + 0.5) * 4 - 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x8a8f98, size: 0.055, transparent: true, opacity: 0.62 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    const alignmentGeometry = new THREE.SphereGeometry(0.08, 12, 12);
    const alignmentMaterial = new THREE.MeshBasicMaterial({ color: 0xe4f222 });
    const alignment = new THREE.Mesh(alignmentGeometry, alignmentMaterial);
    alignment.position.set(3.7, 1.15, 0);
    scene.add(alignment);
    const pointer = { x: 0, y: 0 };
    const onPointer = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.4;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.25;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    const animate = () => {
      frame = requestAnimationFrame(animate);
      points.rotation.y += 0.00045;
      points.rotation.x += (pointer.y - points.rotation.x) * 0.012;
      points.position.x += (pointer.x - points.position.x) * 0.012;
      alignment.scale.setScalar(1 + Math.sin(performance.now() / 700) * 0.18);
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      camera.aspect = target.clientWidth / target.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(target.clientWidth, target.clientHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      alignmentGeometry.dispose();
      alignmentMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={mount} className="hero-field" aria-hidden="true" />;
}
