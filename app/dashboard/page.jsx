"use client";
import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import BTLDashboard from "@/components/BTLDashboard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div style={{ width: "100%", height: "100vh", padding: "10px 20px", boxSizing: "border-box", overflow: "hidden" }}>
        <Suspense fallback={null}>
          <BTLDashboard />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
