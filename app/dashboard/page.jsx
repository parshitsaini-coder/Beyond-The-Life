"use client";
import AuthGuard from "@/components/AuthGuard";
import BTLDashboard from "@/components/BTLDashboard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 980 }}>
          <BTLDashboard />
        </div>
      </div>
    </AuthGuard>
  );
}
