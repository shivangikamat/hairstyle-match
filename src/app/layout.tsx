import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "HairMatch",
  description: "AI hairstyle suggestions with local salon matching",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}

