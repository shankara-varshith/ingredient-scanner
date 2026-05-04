import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ingredient Scanner AI",
  description: "Scan product labels to reveal hidden health impacts with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} h-full antialiased font-sans bg-[#0B0B0B]`}
    >
      <body className="min-h-full flex flex-col text-slate-100 bg-[#0B0B0B]">{children}</body>
    </html>
  );
}
