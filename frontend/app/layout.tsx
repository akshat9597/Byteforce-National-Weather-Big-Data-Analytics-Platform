import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BYTEFORCE | National Weather Intelligence",
  description:
    "National weather monitoring, event intelligence and verification workspace.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
