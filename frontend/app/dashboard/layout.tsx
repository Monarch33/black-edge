import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard — Black Edge",
  description: "Autonomous agent control panel. Configure credentials, monitor execution logs, track PnL.",
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
