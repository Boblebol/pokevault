FROM python:3.14-slim

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
COPY data/evolution-families.json data/evolution-families.json
COPY data/evolution-family-overrides.json data/evolution-family-overrides.json
COPY data/game-pokedexes.json data/game-pokedexes.json
COPY data/badge-battles.json data/badge-battles.json

RUN mkdir -p reference-data
COPY data/pokedex.json reference-data/pokedex.json
COPY data/narrative-tags.json reference-data/narrative-tags.json
COPY data/evolution-families.json reference-data/evolution-families.json
COPY data/evolution-family-overrides.json reference-data/evolution-family-overrides.json
COPY data/game-pokedexes.json reference-data/game-pokedexes.json
COPY data/badge-battles.json reference-data/badge-battles.json

ENV TRACKER_HOST=0.0.0.0
ENV TRACKER_PORT=8765
ENV TRACKER_REFERENCE_DATA_DIR=/app/reference-data

EXPOSE 8765

CMD ["python", "-m", "tracker"]
