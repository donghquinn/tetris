# syntax=docker/dockerfile:1

############################
# 1) Dependencies
############################
FROM node:20-alpine AS deps
WORKDIR /app

# 필수 패키지(일부 네이티브 모듈 대비)
RUN apk add --no-cache libc6-compat

# lockfile 기반 설치 (npm 기준)
COPY package.json package-lock.json ./
RUN npm ci

############################
# 2) Build
############################
FROM node:20-alpine AS build
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remix 빌드
RUN npm run build

############################
# 3) Runtime
############################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 보안: non-root 유저
RUN addgroup -S nodejs && adduser -S remix -G nodejs

# 런타임에 필요한 것만 복사
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public

# (Remix 설정/서버 파일이 필요한 경우를 위해 관용적으로 포함)
# - 보통 remix.config.js, server.js/entry.server.tsx 구성에 따라 필요할 수 있음
COPY --from=build /app/remix.config.* ./ 2>/dev/null || true

USER remix

EXPOSE 3000

# 대부분의 Remix는 "remix-serve build"로 실행
CMD ["npx", "remix-serve", "build", "--port", "3000"]