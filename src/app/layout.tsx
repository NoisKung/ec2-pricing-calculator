import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "AWS EC2 Pricing Calculator",
  description: "เครื่องมือคำนวณราคา AWS EC2 แบบเรียลไทม์ รองรับ On-Demand, Reserved Instance, Savings Plan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${prompt.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
