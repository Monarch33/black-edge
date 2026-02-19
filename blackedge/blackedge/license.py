"""
Vérification de licence (Mock)
==============================
Valide si la clé commence par BE-. Sinon, le terminal se ferme.
"""


def verify_license(key: str) -> bool:
    """
    Vérifie la validité de la clé de licence.

    Mock actuel : la clé doit commencer par "BE-".

    Args:
        key: Clé de licence fournie par le client.

    Returns:
        True si valide, False sinon.
    """
    if not key or not isinstance(key, str):
        return False
    return key.strip().upper().startswith("BE-")
