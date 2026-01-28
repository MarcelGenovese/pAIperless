import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="flex items-center gap-3">
            <Link href="/about" className="hover:opacity-80 transition-opacity">
              <Image
                src="/mg.svg"
                alt="Marcel Genovese"
                width={40}
                height={24}
                className="h-6 w-auto invert dark:invert-0"
              />
            </Link>
            <div className="text-sm text-muted-foreground">
              <p>
                © {currentYear}{' '}
                <Link href="/about" className="hover:text-primary transition-colors font-medium">
                  Marcel Genovese
                </Link>
              </p>
              <p className="text-xs">pAIperless</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-primary transition-colors">
              Info
            </Link>
            <a
              href="mailto:paiperless@mgenovese.de"
              className="hover:text-primary transition-colors"
            >
              Kontakt
            </a>
            <a
              href="https://github.com/MarcelGenovese"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://paypal.me/mg3n0"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Spenden
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
