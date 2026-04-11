FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy everything
COPY . .

# Install ALL deps including devDeps (tailwindcss, postcss needed for build)
RUN npm ci --include=dev
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", ".next/standalone/server.js"]
