// Root Layout — Broken Design
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Broken Design',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
