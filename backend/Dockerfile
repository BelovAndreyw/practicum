# Stub backend — заменить при выборе стека
# Минимальный контейнер с /health эндпоинтом для проверки инфраструктуры
FROM python:3.12-alpine

RUN pip install --no-cache-dir flask

WORKDIR /app

COPY healthcheck.py .

EXPOSE 8000

CMD ["python", "healthcheck.py"]
