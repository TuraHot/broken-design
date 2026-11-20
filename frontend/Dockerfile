FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_CORE_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_CDN_SERVICE_URL=http://localhost:4001
ENV NEXT_PUBLIC_CORE_API_URL=$NEXT_PUBLIC_CORE_API_URL
ENV NEXT_PUBLIC_CDN_SERVICE_URL=$NEXT_PUBLIC_CDN_SERVICE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && rm -rf .next/cache

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "start"]
