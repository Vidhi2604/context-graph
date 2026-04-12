import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { createHash } from "crypto";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
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

        // Attach active org — prefer enterprise > pro > starter, prefer seeded
        const memberships = await prisma.orgMember.findMany({
          where: { userId: token.userId as string },
          include: { org: true },
        });

        const PLAN_RANK: Record<string, number> = { enterprise: 3, pro: 2, starter: 1 };

        const best = memberships.sort((a, b) => {
          // Prefer seeded orgs
          if (a.org.seeded !== b.org.seeded) return a.org.seeded ? -1 : 1;
          // Then prefer higher plan
          const pa = PLAN_RANK[a.org.plan] || 0;
          const pb = PLAN_RANK[b.org.plan] || 0;
          if (pb !== pa) return pb - pa;
          // Tiebreaker: most recently created
          return new Date(b.org.createdAt).getTime() - new Date(a.org.createdAt).getTime();
        })[0];

        if (best) {
          session.orgId = best.org.id;
          session.tenantId = best.org.tenantId;
          session.vertical = best.org.vertical;
          session.plan = best.org.plan;
          session.seeded = best.org.seeded;
          session.apiKey = best.org.apiKey;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
