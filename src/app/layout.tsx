import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

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
  title: "口袋相片 | 你的專屬專業相冊平台，與客戶零距離",
  description: "口袋相片 - 你的專屬專業相冊平台，與客戶零距離",
  openGraph: {
    title: "口袋相片 | 你的專屬專業相冊平台，與客戶零距離",
    description: "口袋相片 - 你的專屬專業相冊平台，與客戶零距離",
    type: "website",
    locale: "zh_TW",
    siteName: "口袋相片",
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
    <ClerkProvider>
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
    </ClerkProvider>
  );
}

