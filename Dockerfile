FROM python:3.13-slim

WORKDIR /app
COPY server.py combat.py world.json world-betrahold.json ./
COPY dist/ ./dist/

EXPOSE 8000
CMD ["python", "-u", "server.py", "--host", "0.0.0.0", "--port", "8000", "--database", "/data/bellward.sqlite3"]
