import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Rest Assured – Strength & Workout Log",
    template: "%s | Rest Assured",
  },
  description:
    "Train hard. Track smarter. Progress with confidence. A minimal strength training tracker built for structured progression.",
  applicationName: "Rest Assured",
  keywords: [
    "workout tracker",
    "strength training",
    "gym log",
    "progress tracking",
    "fitness app",
    "split workout planner",
  ],
  authors: [{ name: "Rest Assured" }],
  creator: "Rest Assured",
  openGraph: {
    title: "Rest Assured – Strength & Workout Log",
    description:
      "Train hard. Track smarter. Progress with confidence.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
