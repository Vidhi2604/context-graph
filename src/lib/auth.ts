import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { createHash } from "crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        // Simple hash comparison (production: bcrypt)
        const hash = createHash("sha256").update(credentials.password).digest("hex");
        if (hash !== user.password) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    newUser: "/onboarding",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;

        // Attach active org to session
        const membership = await prisma.orgMember.findFirst({
          where: { userId: token.userId as string },
          include: { org: true },
          orderBy: { org: { createdAt: "desc" } },
        });

        if (membership) {
          session.orgId = membership.org.id;
          session.tenantId = membership.org.tenantId;
          session.vertical = membership.org.vertical;
          session.plan = membership.org.plan;
          session.seeded = membership.org.seeded;
          session.apiKey = membership.org.apiKey;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
