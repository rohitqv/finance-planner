import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Planner",
  description:
    "Plan investments and retirement in the browser: SIP growth with step-up, " +
    "corpus sizing, bucket-strategy drawdown, and scenario comparison. " +
    "All calculations run client-side — nothing leaves your device.",
  applicationName: "Finance Planner",
  openGraph: {
    title: "Finance Planner",
    description:
      "Investment growth and retirement corpus planning that runs entirely in your browser.",
    type: "website",
  },
};

// Class-based theming (see THEME_INIT_SCRIPT below) can't drive the browser
// chrome colour, so theme-color follows the OS preference instead. It will
// disagree with the chrome only for a user who has manually overridden the
// system theme in-app — a strictly better default than a single colour that
// is wrong half the time.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Applies the saved/system theme before first paint, so there's no
// light->dark flash on load. Runs as a blocking inline script because a
// useEffect in a client component would only run after the initial paint.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("finance-planner:theme");
    var mode = stored === "light" || stored === "dark" ? stored : "system";
    var isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
