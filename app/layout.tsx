import type { Metadata, Viewport } from "next";
import { Big_Shoulders_Stencil, Saira_Stencil_One, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const stencil = Big_Shoulders_Stencil({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-stencil",
  adjustFontFallback: false,
});
const saira = Saira_Stencil_One({ subsets: ["latin"], weight: "400", variable: "--font-saira" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "$watt · he runs. solana stays up.",
  description: "the hamster that keeps solana running.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0F",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${stencil.variable} ${saira.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        {children}
        <div className="vignette" aria-hidden />
        <div className="atmosphere" aria-hidden />
      </body>
    </html>
  );
}
