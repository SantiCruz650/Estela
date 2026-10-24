import { useEffect } from "react";
import HistoryPanel from "../components/HistoryPanel";
import SiteFooter from "../legal/SiteFooter";
import AppHeader from "./AppHeader";
import DemoNotice from "./DemoNotice";
import RequestRunner from "../RequestRunner";
import LogStreamPanel from "../LogStreamPanel";
import { useExtensionStatus } from "../hooks/useExtensionStatus";
import { runDemoSequence } from "../lib/demo-run";
import { isCliMode } from "../config";

export default function DashboardLayout(): JSX.Element {
  const extStatus = useExtensionStatus();

  useEffect(() => {
    // Primer arranque fuera del modo CLI: demo con 4 requests de ejemplo.
    if (!isCliMode()) {
      void runDemoSequence();
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <AppHeader extStatus={extStatus} />
      <DemoNotice />
      <main className="mx-auto flex w-full flex-1 flex-wrap gap-4 pt-4 lg:px-7" style={{ padding: "16px 28px 28px" }}>
        {/* En angosto se apilan: flex-basis mínimo por columna. */}
        <div className="flex min-w-[240px] max-w-full flex-[1_1_220px] flex-col max-lg:max-w-full lg:min-w-0">
          <HistoryPanel />
        </div>
        <div className="flex min-w-[320px] max-w-full flex-[3_1_420px] flex-col lg:min-w-0">
          <RequestRunner extStatus={extStatus} />
        </div>
        <div className="flex min-w-[340px] max-w-full flex-[4_1_580px] flex-col lg:min-w-0">
          <LogStreamPanel />
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}
