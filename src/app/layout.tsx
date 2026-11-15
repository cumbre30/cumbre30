import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RegisterSW } from "@/components/RegisterSW";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cumbre30 · SUBE TU LÍMITE",
  description:
    "Sube tu límite pedaleando: registra tus rides con GPS y te acompaña con avisos informativos del Parque Metropolitano de Santiago (límite 30 km/h), alertas de voz y vibración, zonas de riesgo y credencial digital Pedalea Seguro (QR de Parquemet).",
  applicationName: "Cumbre30",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cumbre30",
  },
  icons: {
    // Favicon del sitio (pestaña del navegador): marca Cumbre GEO
    // (montaña verde + sol ámbar). El ícono de la app Cumbre30 sigue
    // en /icons/icon-*.png vía manifest.webmanifest para la PWA.
    icon: [{ url: "/icons/cumbre-geo.svg", type: "image/svg+xml" }],
    apple: "/icons/cumbre-geo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <RegisterSW />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
