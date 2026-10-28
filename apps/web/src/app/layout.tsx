import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Scrapper",
  description: "Ingest web pages and PDFs, chat with your documents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
