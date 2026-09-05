"use client";
import AuthGuard from "@/components/AuthGuard";
import CircularLauncher from "@/components/CircularLauncher";

export default function LauncherHomePage() {
  return (
    <AuthGuard>
      <CircularLauncher />
    </AuthGuard>
  );
}
