import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { I18nProvider } from "@/providers/I18nProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { DEFAULT_LANGUAGE } from "@/lib/i18n";
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/*
 * 首帧之前就把主题挂到 <html> 上。样式表本来就已经按主题准备好了，缺的只是属性，
 * 慢一步的话暗色主题每次加载都会闪一下浅色。防闪脚本只做这件事，
 * ThemeProvider 里的 initTheme() 仍是唯一真相来源。
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t)document.documentElement.setAttribute("${THEME_ATTRIBUTE}",t)}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <I18nProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </I18nProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
