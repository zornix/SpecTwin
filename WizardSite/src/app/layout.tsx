import type { Metadata } from "next";
import { Bodoni_Moda, Geist, Geist_Mono } from "next/font/google";

import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://spectra.example.com"),
  title: {
    default: "SpecTwin — Find any frame's cheaper twin",
    template: "%s · SpecTwin",
  },
  description:
    "Paste any pair of sunglasses. SpecTwin matches it to cheaper frames on the measurements that decide fit and look — down to the millimetre. The spec is the product; the logo is the markup.",
  openGraph: {
    title: "SpecTwin — Find any frame's cheaper twin",
    description:
      "Paste any pair of sunglasses and SpecTwin finds the cheaper frame that matches it — shape, size and style, scored.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        <a
          href="#main"
          className="label-mono sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <SmoothScroll>
            {children}
            <Toaster position="bottom-right" />
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}
