import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brand Guide Generator",
  description: "Generate a brand guide from a homepage URL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-10 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
              Brand Guide Generator
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter a homepage URL to extract brand intelligence and generate a Markdown guide
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
