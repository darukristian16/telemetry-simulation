import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Inter } from "next/font/google";
import { ResetConnection } from "@/components/reset-connection";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Device Management Dashboard",
  description: "A comprehensive dashboard for device management and configuration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ResetConnection />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}