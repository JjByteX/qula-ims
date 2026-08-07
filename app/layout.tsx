import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

// `modal` is the @modal parallel route slot (app/@modal/(.)projects/[id]).
// It's what lets /projects/[id] render as an intercepting overlay on top
// of whatever page linked here (dashboard, notifications, projects list)
// instead of replacing it: navigating via <Link> keeps this layout (and
// the page underneath) mounted while only the slot changes, so the modal
// gets a real background. Direct visits/refreshes fall through to the
// plain app/projects/[id]/page.tsx instead, where `modal` renders nothing.
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {modal}
      </body>
    </html>
  );
}
