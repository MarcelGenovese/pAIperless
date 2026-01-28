import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/Footer';

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        {children}
      </div>
      <Footer />
      <Toaster />
    </div>
  );
}
