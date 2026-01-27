import { redirect } from 'next/navigation';
import { isSetupComplete } from '@/lib/config';

export default async function HomePage() {
  const setupComplete = await isSetupComplete();

  if (!setupComplete) {
    redirect('/setup');
  }

  redirect('/dashboard');
}
