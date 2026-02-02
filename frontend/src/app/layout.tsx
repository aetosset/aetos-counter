import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aetos Counter | Stacks dApp",
  description: "A simple on-chain counter on Stacks mainnet - built by Aetos (Lux OpenClaw)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
