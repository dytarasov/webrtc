# Stage 1: Build FastAPI application
FROM python:3.12-slim as backend

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл requirements.txt из директории /app
COPY ./app/requirements.txt /app/

# Создаем виртуальное окружение и устанавливаем зависимости
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Копируем все файлы приложения из директории /app
COPY ./app /app

# Stage 2: Подготовка для раздачи фронта и запуска бэкенда
FROM python:3.12-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем Nginx и устанавливаем необходимые пакеты
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Копируем конфигурацию Nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

# Копируем файлы фронтенда в директорию, из которой Nginx раздает статику
COPY ./frontend /usr/share/nginx/html
COPY /etc/letsencrypt /etc/letsencrypt

# Копируем FastAPI сервер и виртуальное окружение из предыдущего слоя в контейнер
COPY --from=backend /app /app

# Команда для запуска Uvicorn и Nginx
CMD ["sh", "-c", "/app/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 & nginx -g 'daemon off;'"]
