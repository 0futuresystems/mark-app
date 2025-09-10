import AuthGuard from "@/src/components/AuthGuard";
import Header from "@/src/components/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {/* Centered, readable content area with larger padding for Mark */}
      <main className="mx-auto max-w-xl p-5 pb-24 space-y-6">
        <Header />
        {children}
      </main>
    </AuthGuard>
  );
}
