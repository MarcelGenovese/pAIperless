import Image from 'next/image';
import { Toaster } from '@/components/ui/toaster';

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-block logo-container">
            <Image
              src="/logo_complete.png"
              alt="pAIperless"
              width={300}
              height={80}
              className="h-20 w-auto"
              priority
            />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {children}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
