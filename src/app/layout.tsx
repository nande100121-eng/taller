import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navigation/navbar";
import { SupabaseSyncProvider } from "@/components/providers/supabase-sync-provider";

export const metadata: Metadata = {
  title: "REYGAS AUTOGAS EQUIPMENT | Conversiones y Mantenimiento GNV/GLP",
  description: "Taller especializado en conversiones a GNV y GLP de 5ta Generación, mantenimiento computarizado de inyectores, certificaciones anuales y pruebas hidrostáticas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-reygas-dark text-white min-h-screen flex flex-col antialiased">
        <SupabaseSyncProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </SupabaseSyncProvider>
      </body>
    </html>
  );
}
