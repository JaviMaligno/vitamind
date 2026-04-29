"use client";

import { useInstallContext } from "@/context/InstallProvider";

export function useInstallPrompt() {
  return useInstallContext();
}
