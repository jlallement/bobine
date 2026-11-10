"""Calculs du panier de La Bobinette : sous-total, remise et total."""

SEUIL_REMISE = 20.0
TAUX_REMISE = 0.10


def sous_total(lignes):
    """Somme de prix × quantité pour chaque ligne (dictionnaires « prix » et « quantite »)."""
    return round(sum(ligne["prix"] * ligne["quantite"] for ligne in lignes), 2)


def remise(montant):
    """10 % de remise à partir de 20 € d'achats."""
    if montant > SEUIL_REMISE:
        return round(montant * TAUX_REMISE, 2)
    return 0.0


def total(lignes):
    """Sous-total moins la remise."""
    montant = sous_total(lignes)
    return round(montant - remise(montant), 2)
