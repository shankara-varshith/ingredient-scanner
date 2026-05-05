import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ingredient Scanner — Know What's Really Inside",
  description:
    "Scan product labels instantly. AI identifies every ingredient and reveals the health benefits, risks, and dosage data you deserve to know before you buy.",
  keywords: ["ingredient scanner", "health analysis", "food safety", "AI nutrition", "product label scanner"],
  openGraph: {
    title: "Ingredient Scanner — Know What's Really Inside",
    description: "AI-powered ingredient analysis. Scan any product label and instantly see health risks, benefits, and dosage data.",
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
      className={`${inter.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050A07] text-slate-100">
        {children}
      </body>
    </html>
  );
}
