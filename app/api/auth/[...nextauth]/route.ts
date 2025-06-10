import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import MicrosoftProvider from "next-auth/providers/azure-ad";
// @ts-ignore - No declaration file for bcrypt
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { NextAuthOptions } from "next-auth";

// Define custom user type to include the role field
type UserWithRole = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
};

// Extend Session type
declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}

// Extend JWT type
declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}

// Create a custom NextAuth configuration
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(credentials.password, user.password);

          if (!passwordMatch) {
            return null;
          }

          // Return user with role
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          } as UserWithRole;
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    MicrosoftProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Cast user to our custom type that includes role
      const userWithRole = user as UserWithRole | undefined;
      if (userWithRole) {
        token.role = userWithRole.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Add role to session user
      if (session?.user) {
        session.user.role = token.role;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log(`Redirecting: URL = ${url}, baseUrl = ${baseUrl}`);
      
      // Special case: handle dashboard redirects
      if (url === '/dashboard' || url.startsWith('/dashboard')) {
        return `${baseUrl}/dashboard`;
      }
      
      // Handle absolute URLs within the app
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // Handle relative URLs (to ensure they're not appended to current path)
      if (!url.startsWith('http')) {
        return `${baseUrl}/${url}`;
      }
      
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      
      // Default fallback to dashboard
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET || "your-fallback-secret-key",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 