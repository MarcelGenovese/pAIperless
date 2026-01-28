"use client"

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faCog } from '@fortawesome/free-solid-svg-icons';

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/logo_complete.png"
                alt="pAIperless"
                width={180}
                height={50}
                className="h-10 w-auto"
                priority
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Welcome, {session?.user?.name || 'User'}
              </span>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/auth/login' })}>
                <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg p-6">
          <h1 className="text-3xl font-bold text-accent mb-4">
            Dashboard
          </h1>
          <p className="text-gray-600 mb-6">
            Welcome to pAIperless! Your document processing system is ready.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border p-4">
              <h3 className="font-semibold text-accent mb-2">Documents Processed</h3>
              <p className="text-3xl font-bold text-gray-900">0</p>
            </div>
            <div className="border p-4">
              <h3 className="font-semibold text-accent mb-2">Pending Actions</h3>
              <p className="text-3xl font-bold text-gray-900">0</p>
            </div>
            <div className="border p-4">
              <h3 className="font-semibold text-accent mb-2">API Calls This Month</h3>
              <p className="text-3xl font-bold text-gray-900">0</p>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/dashboard/settings">
              <Button>
                <FontAwesomeIcon icon={faCog} className="mr-2" />
                Einstellungen
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
