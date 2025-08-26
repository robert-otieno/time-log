import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import NudgeBanner from "@/components/nudge-banner";
import { Geist, Geist_Mono } from "next/font/google";
import { FocusModeProvider } from "@/hooks/use-focus-mode";
import { SelectedDateProvider } from "@/hooks/use-selected-date";
import { AuthProvider } from "@/components/auth-provider";
import AuthGuard from "@/components/auth-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Visio Genesis - Activity Tracker",
  description: "From Vision to Reality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}>
        {/* <AuthGuard> */}
          <AuthProvider>
            <SelectedDateProvider>
              <FocusModeProvider>
                <NudgeBanner />
                {children}
              </FocusModeProvider>
            </SelectedDateProvider>
          </AuthProvider>
        {/* </AuthGuard> */}
        <Toaster />
      </body>
    </html>
  );
}
