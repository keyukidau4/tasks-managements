FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run prisma:generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "if [ -z \"${REDIS_PASSWORD:-}\" ]; then unset REDIS_PASSWORD; fi; if [ -z \"${SMTP_USER:-}\" ]; then unset SMTP_USER; fi; if [ -z \"${SMTP_PASS:-}\" ]; then unset SMTP_PASS; fi; npm run prisma:deploy && npm run start:prod"]
