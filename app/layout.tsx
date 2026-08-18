import type { Metadata } from "next";
import { League_Spartan, Manrope, Newsreader } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "365x100 — Write today",
  description: "Write 100 words a day and preserve the story of your year. Track your progress, revisit your memories, and turn 365 days or each month of writing into a personal chapter.",
  icons: {
    apple: [
      {
        sizes: "180x180",
        type: "image/png",
        url: "/apple-touch-icon.png",
      },
    ],
    icon: [
      {
        sizes: "512x512",
        type: "image/png",
        url: "/365x100-icon.png",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${newsreader.variable} ${leagueSpartan.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
