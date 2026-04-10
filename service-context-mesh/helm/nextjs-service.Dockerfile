FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy everything
COPY . .

# Install and build
RUN npm ci
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node .next/standalone/server.js"]
