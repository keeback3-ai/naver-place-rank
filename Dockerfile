FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx playwright install --with-deps chromium

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
