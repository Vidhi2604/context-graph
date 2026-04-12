FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy everything
COPY . .

# Install ALL deps (including devDeps needed for build: tailwindcss, postcss, etc.)
RUN npm ci --include=dev
RUN npm run build

# Copy static assets into standalone output (required for CSS/JS to be served)
RUN cp -r .next/static .next/standalone/.next/static && \
    if [ -d public ]; then cp -r public .next/standalone/public; fi

ENV NODE_ENV=production

EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --skip-generate && node .next/standalone/server.js"]
