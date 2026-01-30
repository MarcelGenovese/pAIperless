import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getConfig, CONFIG_KEYS } from '@/lib/config';
import SessionProvider from '@/components/SessionProvider';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "pAIperless - AI-powered Document Processing",
  description: "AI-powered extension for Paperless-NGX with intelligent document processing, automated tagging, and action tracking.",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const darkMode = await getConfig(CONFIG_KEYS.DARK_MODE);
  const isDark = darkMode === 'true';

  // Load messages dynamically
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={isDark ? 'dark' : ''} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const darkMode = ${isDark};
                if (darkMode) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
            <Toaster />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
