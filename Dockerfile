# Stage 1: Build FastAPI application
FROM python:3.12 as backend

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл requirements.txt из директории /app
COPY ./app/requirements.txt /app/

# Устанавливаем зависимости, включая Uvicorn
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все файлы приложения из директории /app
COPY ./app /app

# Stage 2: Подготовка Nginx для раздачи фронта и проксирования
FROM nginx:alpine

# Копируем конфигурацию Nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

# Копируем файлы фронтенда в директорию, из которой Nginx раздает статику
COPY ./frontend /usr/share/nginx/html

# Копируем FastAPI сервер из предыдущего слоя в контейнер
COPY --from=backend /app /app

# Устанавливаем Uvicorn
RUN apk add --no-cache python3 py3-pip && pip install uvicorn

# Команда для запуска Uvicorn и Nginx
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 & nginx -g 'daemon off;'"]
