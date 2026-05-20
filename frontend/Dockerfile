# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Значения можно переопределить через --build-arg или CI env
ARG VITE_API_BASE=/api
ARG VITE_USE_MOCK=false
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

# ---------- serve stage ----------
FROM nginx:1.27-alpine AS server
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
