import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ClientOnly } from "@/components/client-only";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Teslimatjet Admin",
  description: "Operasyon ve sipariş yönetimi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <AuthProvider>
          <ClientOnly>{children}</ClientOnly>
        </AuthProvider>
      </body>
    </html>
  );
}
