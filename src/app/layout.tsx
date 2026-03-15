import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import N8nChatWidget from "@/components/N8nChatWidget";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: "HairMatch",
  description: "AI hairstyle suggestions with local salon matching",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} text-slate-100 antialiased selection:bg-teal-500/30`}>
        {children}
        <N8nChatWidget />
      </body>
    </html>
  );
}
