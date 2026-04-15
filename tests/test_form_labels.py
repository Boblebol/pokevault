"""pokedex.form_labels — primales, partenaires, Pikachu spéciaux, Zarbi lettre."""

from pokedex.form_labels import detect_form, refine_form_label, resolve_stored_form_label


class TestPrimal:
    def test_primo_kyogre(self) -> None:
        assert (
            resolve_stored_form_label("Primo-Kyogre", "Primal Kyogre", "0382", "0382-kyogre-primal")
            == "Forme primale"
        )

    def test_primo_groudon_slug(self) -> None:
        result = refine_form_label("Groudon", "Groudon", "0383", "0383-groudon-primal", None)
        assert result == "Forme primale"


class TestPartner:
    def test_pikachu_partenaire_fr(self) -> None:
        assert (
            resolve_stored_form_label("Pikachu Partenaire", "Pikachu", "0025", "0025-pikachu")
            == "Forme partenaire"
        )

    def test_evoli_partner_en(self) -> None:
        assert (
            resolve_stored_form_label("Évoli", "Partner Eevee", "0133", "0133-eevee")
            == "Forme partenaire"
        )

    def test_evoli_partner_fr(self) -> None:
        assert (
            resolve_stored_form_label("Évoli partenaire", "Eevee", "0133", "0133-evoli")
            == "Forme partenaire"
        )


class TestPikachuSpecial:
    def test_plain_pikachu_no_form(self) -> None:
        assert resolve_stored_form_label("Pikachu", "Pikachu", "0025", "0025-pikachu") is None

    def test_cosplay_style_name(self) -> None:
        result = resolve_stored_form_label(
            "Pikachu Lady", "Pikachu Pop Star", "0025", "0025-pikachu-pop-star",
        )
        assert result == "Forme spéciale Pikachu"

    def test_gigamax_kept(self) -> None:
        result = resolve_stored_form_label(
            "Pikachu Gigamax", "Gigantamax Pikachu", "0025", "0025-pikachu",
        )
        assert result == "Gigamax"


class TestZarbiLettre:
    def test_slug_with_letter_suffix(self) -> None:
        assert (
            resolve_stored_form_label("Zarbi", "Unown", "0201", "0201-unown-h")
            == "Zarbi lettre"
        )

    def test_name_fr_zarbi_plus_letter(self) -> None:
        result = resolve_stored_form_label("Zarbi H", "Unown H", "0201", "0201-unown")
        assert result == "Zarbi lettre"

    def test_plain_zarbi_no_form(self) -> None:
        assert resolve_stored_form_label("Zarbi", "Unown", "0201", "0201-unown") is None

    def test_plain_zarbi_slug_zarbi(self) -> None:
        assert resolve_stored_form_label("Zarbi", "Unown", "0201", "0201-zarbi") is None

    def test_unown_english_name_suffix(self) -> None:
        assert resolve_stored_form_label("Zarbi", "Unown B", "0201", "0201-unown") == "Zarbi lettre"


class TestDetectFormUnchanged:
    def test_mega_still_detected(self) -> None:
        assert detect_form("Dracaufeu Méga X") == "Méga X"

    def test_meganium_name_is_not_mega_form(self) -> None:
        assert detect_form("Méganium") is None
