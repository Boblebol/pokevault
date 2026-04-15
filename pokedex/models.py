"""
pokedex/models.py — Modèles Pydantic pour le Pokédex
"""

from __future__ import annotations

from datetime import datetime, timezone  # noqa: UP017

from pydantic import BaseModel, Field, model_validator

SOURCE_URL = (
    "https://www.pokepedia.fr/"
    "Liste_des_Pok%C3%A9mon_dans_l%27ordre_du_Pok%C3%A9dex_National"
)


class PokemonNames(BaseModel):
    fr: str | None = None
    en: str | None = None
    ja: str | None = None

    def display(self) -> str:
        """Retourne le meilleur nom disponible."""
        return self.fr or self.en or self.ja or "?"

    def all_names(self) -> dict[str, str]:
        return {k: v for k, v in self.model_dump().items() if v}


class Pokemon(BaseModel):
    number: str = Field(..., description="Numéro national, ex: '0001'")
    slug: str = Field(..., description="Identifiant kebab-case unique, ex: '0001-bulbasaur'")
    names: PokemonNames
    types: list[str] = Field(default_factory=list, max_length=2)
    form: str | None = Field(
        None,
        description="Variante (Méga X, d'Alola, Forme primale, Forme partenaire, Forme spéciale Pikachu, Zarbi lettre…)",
    )
    image: str | None = Field(None, description="Chemin local vers l'image téléchargée")
    region: str = Field(
        default="",
        description="Région d'affichage (forme régionale prioritaire sur le n° national)",
    )
    region_dex: str = Field(default="", description="Région déduite du seul numéro national")
    region_label_fr: str = Field(default="", description="Libellé français de `region`")
    region_native: bool = Field(
        default=True,
        description="True si le n° tombe dans la tranche de `region` (sinon forme importée)",
    )

    @model_validator(mode="after")
    def number_padded(self) -> Pokemon:
        if self.number and not self.number.startswith("#"):
            self.number = self.number.zfill(4)
        return self

    @model_validator(mode="after")
    def fill_regions_if_missing(self) -> Pokemon:
        if self.region:
            return self
        from pokedex.regions import attach_region_fields

        d = attach_region_fields(self.number, self.names.model_dump(), self.form)
        self.region = d["region"]
        self.region_dex = d["region_dex"]
        self.region_label_fr = d["region_label_fr"]
        self.region_native = d["region_native"]
        return self

    def types_str(self, sep: str = "/") -> str:
        return sep.join(self.types)

    def has_image(self) -> bool:
        from pathlib import Path
        return self.image is not None and Path(self.image).exists()


class Pokedex(BaseModel):
    pokemon: list[Pokemon] = Field(default_factory=list)
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    source_url: str = SOURCE_URL
    total: int = 0

    @model_validator(mode="after")
    def set_total(self) -> Pokedex:
        self.total = len(self.pokemon)
        return self

    # ── Lookup helpers ──────────────────────────────────────────────────────

    def by_number(self, number: str) -> list[Pokemon]:
        """Retourne tous les Pokémon avec ce numéro (formes incluses)."""
        padded = number.zfill(4)
        return [p for p in self.pokemon if p.number == padded]

    def by_type(self, type_name: str) -> list[Pokemon]:
        """Filtre par type (insensible à la casse)."""
        t = type_name.lower()
        return [p for p in self.pokemon if any(tt.lower() == t for tt in p.types)]

    def search(self, query: str) -> list[Pokemon]:
        """Recherche dans tous les noms (insensible à la casse)."""
        q = query.lower()
        results = []
        for p in self.pokemon:
            names = [v for v in p.names.all_names().values() if v]
            if any(q in n.lower() for n in names) or q in p.slug:
                results.append(p)
        return results

    def by_region(self, region_id: str | None) -> list[Pokemon]:
        """Filtre par id de région d’affichage (``all`` / ``None`` = tout le Pokédex)."""
        from pokedex.regions import filter_pokemon_by_region

        return filter_pokemon_by_region(self.pokemon, region_id)

    def update_pokemon(self, slug: str, **fields) -> bool:
        """Met à jour les champs d'un Pokémon par son slug. Retourne True si trouvé."""
        for p in self.pokemon:
            if p.slug == slug:
                for key, value in fields.items():
                    if "." in key:
                        # Champ imbriqué ex: "names.fr"
                        parent, child = key.split(".", 1)
                        sub = getattr(p, parent, None)
                        if sub is not None:
                            setattr(sub, child, value)
                    else:
                        setattr(p, key, value)
                self.total = len(self.pokemon)
                return True
        return False
