FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

RUN uv export --no-dev --frozen --no-hashes -o requirements.txt \
    && pip install --no-cache-dir -r requirements.txt \
    && rm requirements.txt

COPY pokedex/ pokedex/
COPY tracker/ tracker/
COPY web/ web/
COPY main.py .

RUN mkdir -p data
COPY data/pokedex.json data/pokedex.json
COPY data/narrative-tags.json data/narrative-tags.json

ENV TRACKER_HOST=0.0.0.0
ENV TRACKER_PORT=8765

EXPOSE 8765

CMD ["python", "-m", "tracker"]
