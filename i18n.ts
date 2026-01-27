import { getRequestConfig } from 'next-intl/server';
import { getLocale } from '@/lib/config';

export default getRequestConfig(async () => {
  // Get locale from database config
  const locale = await getLocale();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
