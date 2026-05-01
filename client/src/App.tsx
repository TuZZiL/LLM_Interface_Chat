import { AppProvider } from "./context/AppContext";
import { TopBar } from "./components/layout/TopBar";
import { Sidebar } from "./components/layout/Sidebar";
import { Inspector, InspectorContent } from "./components/layout/Inspector";
import { ChatArea } from "./components/chat/ChatArea";
import { Composer } from "./components/composer/Composer";
import { ToastContainer } from "./components/ui/Toast";
import {
  MobileDrawer,
  MobileSidebarContent,
} from "./components/layout/MobileDrawer";
import { useState } from "react";

function AppContent() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSide, setDrawerSide] = useState<"sessions" | "inspector">(
    "sessions"
  );

  const openSessions = () => {
    setDrawerSide("sessions");
    setDrawerOpen(true);
  };
  const openInspector = () => {
    setDrawerSide("inspector");
    setDrawerOpen(true);
  };

  return (
    <>
      <TopBar onMenuClick={openSessions} onInspectorClick={openInspector} />
      <Sidebar />
      <main className="fixed inset-0 left-0 right-0 md:left-60 md:right-72 top-14 bottom-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#050505] to-[#0a0a0b]">
        <ChatArea />
        <Composer />
      </main>
      <Inspector />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side={drawerSide}
      >
        {drawerSide === "sessions" ? (
          <MobileSidebarContent onClose={() => setDrawerOpen(false)} />
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="text-white font-bold text-label font-mono uppercase">
                Inspector
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-outline hover:text-on-surface text-lg"
              >
                ✕
              </button>
            </div>
            <InspectorContent />
          </div>
        )}
      </MobileDrawer>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
