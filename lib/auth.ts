import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Paperless-NGX',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const { getConfig } = await import('@/lib/config');
          const paperlessUrl = await getConfig('PAPERLESS_URL');
          
          if (!paperlessUrl) {
            throw new Error('Paperless URL not configured');
          }

          // Authenticate with Paperless-NGX
          const response = await fetch(`${paperlessUrl}/api/token/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          // Check if user is admin/superuser
          const userResponse = await fetch(`${paperlessUrl}/api/users/`, {
            headers: {
              'Authorization': `Token ${data.token}`,
            },
          });

          if (!userResponse.ok) {
            console.error('Failed to fetch user list from Paperless');
            return null;
          }

          const users = await userResponse.json();
          const currentUser = users.results?.find(
            (u: any) => u.username === credentials.username
          );

          if (!currentUser) {
            console.error('User not found in Paperless user list');
            return null;
          }

          if (!currentUser.is_superuser) {
            console.error('User is not a superuser:', credentials.username);
            return null;
          }

          return {
            id: credentials.username,
            name: credentials.username,
            email: credentials.username,
            token: data.token,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to true in production with HTTPS
      },
    },
  },
  debug: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.paperlessToken = (user as any).token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).paperlessToken = token.paperlessToken;
      }
      return session;
    },
  },
};
