import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from "sonner"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Choon - Music Guessing Game',
  description: 'Test your music knowledge with Choon, the ultimate music guessing game!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}