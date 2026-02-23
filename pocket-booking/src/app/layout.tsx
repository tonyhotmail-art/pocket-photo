import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparlex - Spa Website Template",
  description: "口袋預約 - Spa Website Template",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Google Web Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=PT+Serif:wght@400;700&display=swap" rel="stylesheet" />

        {/* Icon Font Stylesheet */}
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.4.1/font/bootstrap-icons.css" rel="stylesheet" />

        {/* Libraries Stylesheet */}
        <link href="/lib/animate/animate.min.css" rel="stylesheet" />
        <link href="/lib/lightbox/css/lightbox.min.css" rel="stylesheet" />
        <link href="/lib/owlcarousel/assets/owl.carousel.min.css" rel="stylesheet" />

        {/* Customized Bootstrap Stylesheet */}
        <link href="/css/bootstrap.min.css" rel="stylesheet" />

        {/* Template Stylesheet */}
        <link href="/css/style.css" rel="stylesheet" />
      </head>
      <body>
        {children}

        {/* JavaScript Libraries */}
        <Script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.4/jquery.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js" strategy="beforeInteractive" />

        <Script src="/lib/wow/wow.min.js" strategy="lazyOnload" />
        <Script src="/lib/easing/easing.min.js" strategy="lazyOnload" />
        <Script src="/lib/waypoints/waypoints.min.js" strategy="lazyOnload" />
        <Script src="/lib/counterup/counterup.min.js" strategy="lazyOnload" />
        <Script src="/lib/lightbox/js/lightbox.min.js" strategy="lazyOnload" />
        <Script src="/lib/owlcarousel/owl.carousel.min.js" strategy="lazyOnload" />

        {/* Template Javascript */}
        <Script src="/js/main.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
