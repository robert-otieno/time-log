import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NudgeBanner from "@/components/nudge-banner";
import { DM_Sans, Geist_Mono, Outfit } from "next/font/google";
import { FocusModeProvider } from "@/hooks/use-focus-mode";
import { SelectedDateProvider } from "@/hooks/use-selected-date";
import { AuthProvider } from "@/components/auth-provider";
import AuthGuard from "@/components/auth-guard";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { cn } from "@/lib/utils";

const outfitHeading = Outfit({ subsets: ["latin"], variable: "--font-heading" });

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang='en' suppressHydrationWarning className={cn("font-sans", dmSans.variable, outfitHeading.variable)}>
      <body className={`${geistMono.variable} antialiased`}>
        <ThemeProvider attribute='class' defaultTheme='system'>
          <TooltipProvider>
            <AuthProvider>
              <AuthGuard>
                <SelectedDateProvider>
                  <FocusModeProvider>
                    <NudgeBanner />
                    <NavigationFeedback />
                    {children}
                    <Analytics />
                  </FocusModeProvider>
                </SelectedDateProvider>
              </AuthGuard>
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
