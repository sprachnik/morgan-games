import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

import { SiteFooter } from "@/components/site-footer";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Morgan's Game Time!",
  description: "A colourful collection of games made just for Morgan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
