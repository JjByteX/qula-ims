import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MilestonesDialogProvider } from "@/app/projects/milestones-dialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qula IMS",
  description: "Qula Internal Management System",
};

// MilestonesDialogProvider mounts the milestones popup once here so any
// page (dashboard, projects list, notification menu) can open it via
// useMilestonesDialog().openProject(id) without prop-drilling. Plain
// client state, no dedicated route or parallel-route slot — see
// app/projects/milestones-dialog.tsx for why that replaced the previous
// @modal intercepting-route approach.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MilestonesDialogProvider>{children}</MilestonesDialogProvider>
      </body>
    </html>
  );
}

