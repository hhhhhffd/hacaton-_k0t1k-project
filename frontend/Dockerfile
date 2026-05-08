# Этап 1: сборка React-приложения
FROM node:20-alpine AS builder

WORKDIR /app

# Build args — пробрасываются из docker-compose → .env
ARG VITE_GOOGLE_CLIENT_ID=""

# Vite инлайнит VITE_* переменные при сборке
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# Копируем package-lock и package.json для кэширования зависимостей
COPY package.json package-lock.json ./

# npm ci с пересборкой нативных модулей (rolldown binding для alpine/musl)
RUN npm ci --no-audit --no-fund && npm rebuild

# Копируем исходники и собираем
COPY . .
RUN npm run build

# Этап 2: nginx для раздачи статики
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем nginx конфиг с проксированием API
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
