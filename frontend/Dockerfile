# Stub frontend — заменить при выборе стека
# Минимальный контейнер со статической страницей для проверки инфраструктуры
FROM nginx:1.25-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY nginx-stub.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
