import type { Metadata } from "next";
import "./globals.css";
import { getModo } from "@/lib/env";
import ModoBanner from "@/components/ModoBanner";

export const metadata: Metadata = {
  title: "Firma opción de sede - Sala Civil Familia",
  description:
    "Firma electrónica de la carta de manifestación de sede de preferencia ante la Sala Plena de la Corte Suprema de Justicia.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const modo = getModo();
  return (
    <html lang="es">
      <body>
        <ModoBanner modo={modo} />
        <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
