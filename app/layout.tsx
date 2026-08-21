import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Finanças da Família Silva",
  description: "Controle de contas fixas, variáveis, futuras e investimentos",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Finanças da Família Silva",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#14915d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
