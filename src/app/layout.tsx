import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MikroTik Manager",
  description: "Web-based MikroTik RouterOS management panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
