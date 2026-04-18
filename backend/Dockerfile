FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# System deps for common Python wheels (bcrypt/cryptography/psycopg style)
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc libffi-dev \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
  && python -m pip install -r requirements.txt

COPY app ./app

RUN mkdir -p /app/uploads/posts

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
FROM python:3.12-alpine

# Для bcrypt/cryptography/asyncpg иногда нужны системные библиотеки
RUN apk add --no-cache gcc musl-dev libffi-dev openssl-dev

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Поднимаем FastAPI приложение
COPY app ./app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8000}"]
