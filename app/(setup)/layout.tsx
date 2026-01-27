import { Toaster } from '@/components/ui/toaster';

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {children}
      <Toaster />
    </div>
  );
}
