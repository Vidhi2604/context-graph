FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY public ./public 2>/dev/null || true
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true
COPY node_modules/@prisma ./node_modules/@prisma 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
