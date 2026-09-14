import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { I18nProvider } from "@/providers/I18nProvider";
import { DEFAULT_LANGUAGE } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The language attribute is kept in sync on the client by I18nProvider.
    <html
      lang={DEFAULT_LANGUAGE === "zh" ? "zh-CN" : "en"}
      suppressHydrationWarning
    >
      <body
        className={inter.className}
        suppressHydrationWarning
      >
        <I18nProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
