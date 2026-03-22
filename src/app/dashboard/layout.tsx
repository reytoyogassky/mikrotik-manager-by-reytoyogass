import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isConnected) redirect("/");

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar host={session.host!} username={session.username!}/>
        {/* pt-14 = tinggi mobile top bar, md:pt-0 = desktop tidak perlu */}
        <main className="flex-1 overflow-y-auto bg-bg-base grid-bg pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
