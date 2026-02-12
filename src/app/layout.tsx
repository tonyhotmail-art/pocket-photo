import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Kelly's Portfolio | 彩妝作品集",
  description: "專業彩妝造型作品集 - 日系極簡美學",
  openGraph: {
    title: "Kelly's Portfolio | 彩妝作品集",
    description: "專業彩妝造型作品集 - 日系極簡美學",
    type: "website",
    locale: "zh_TW",
    siteName: "Kelly's Portfolio",
  },
};

import SmoothScroll from "@/components/SmoothScroll";
import { AuthProvider } from "@/components/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Google Identity Services for OAuth 2.0 */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerifTC.variable} antialiased`}
      >
        <AuthProvider>
          <SmoothScroll />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

