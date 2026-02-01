import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Get locale from cookie with fallback
  const cookieStore = cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE');
  const locale = localeCookie?.value || 'de'; // Default to German

  console.log('[i18n] Loading locale:', locale, 'from cookie:', localeCookie ? 'found' : 'not found');

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
