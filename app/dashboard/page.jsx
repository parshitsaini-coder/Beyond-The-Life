"use client";
import AuthGuard from "@/components/AuthGuard";
import BTLDashboard from "@/components/BTLDashboard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div style={{ width: "100%", padding: "16px 24px", boxSizing: "border-box" }}>
        <BTLDashboard />
      </div>
    </AuthGuard>
  );
}
