import AuthGuard from "@/components/AuthGuard";
import AppHeader from "@/components/AppHeader";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-brand-bg">
        <AppHeader />
        {/* Centered, readable content area with larger padding for Mark */}
        <main className="mx-auto max-w-xl p-5 pb-24 space-y-6">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
