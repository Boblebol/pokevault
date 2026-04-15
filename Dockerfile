FROM python:3.12-slim AS base

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY pokedex/ pokedex/
COPY tracker/ tracker/
COPY web/ web/
COPY main.py .

RUN mkdir -p data

ENV TRACKER_HOST=0.0.0.0
ENV TRACKER_PORT=8765

EXPOSE 8765

CMD ["uv", "run", "python", "-m", "tracker"]
