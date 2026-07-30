"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  organizationId: string;
  protocolId: string;
  sidebarOpen: boolean;
  demoOpen: boolean;
  onboardingStep: number;
  setOrganization: (id: string) => void;
  setProtocol: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setDemoOpen: (open: boolean) => void;
  setOnboardingStep: (step: number) => void;
}
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      organizationId: "org-arcadia",
      protocolId: "arcadia",
      sidebarOpen: false,
      demoOpen: false,
      onboardingStep: 0,
      setOrganization: (organizationId) => set({ organizationId }),
      setProtocol: (protocolId) => set({ protocolId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setDemoOpen: (demoOpen) => set({ demoOpen }),
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
    }),
    { name: "aether-ui", partialize: ({ organizationId, protocolId, onboardingStep }) => ({ organizationId, protocolId, onboardingStep }) },
  ),
);
