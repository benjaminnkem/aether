"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  organizationId: string;
  protocolId: string;
  sidebarOpen: boolean;
  onboardingStep: number;
  setOrganization: (id: string) => void;
  setProtocol: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setOnboardingStep: (step: number) => void;
}
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      organizationId: "",
      protocolId: "",
      sidebarOpen: false,
      onboardingStep: 0,
      setOrganization: (organizationId) => set({ organizationId }),
      setProtocol: (protocolId) => set({ protocolId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
    }),
    {
      name: "aether-ui",
      partialize: ({ organizationId, protocolId, onboardingStep }) => ({
        organizationId,
        protocolId,
        onboardingStep,
      }),
    },
  ),
);
