"use client"

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        const errorMessage = result.error.includes('Admin-Rechte')
          ? 'Login fehlgeschlagen: Admin-Rechte erforderlich'
          : 'Ungültiger Benutzername oder Passwort';

        toast({
          title: 'Anmeldung fehlgeschlagen',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white shadow-lg">
      {/* Header */}
      <div className="text-center border-b px-6 py-4">
        <Image
          src="/logo_complete.png"
          alt="pAIperless"
          width={300}
          height={80}
          className="h-16 w-auto mx-auto mb-3"
          priority
        />
        <h1 className="text-2xl font-bold text-accent mb-2">
          Login
        </h1>
        <p className="text-sm text-gray-600">
          Sign in with your Paperless-NGX credentials
        </p>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
          <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
        </Button>
      </form>
    </div>
  );
}
