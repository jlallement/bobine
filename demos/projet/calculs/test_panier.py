import unittest

from panier import remise, sous_total, total


class TestPanier(unittest.TestCase):
    def test_sous_total(self):
        lignes = [{"prix": 2.5, "quantite": 2}, {"prix": 1.8, "quantite": 1}]
        self.assertEqual(sous_total(lignes), 6.8)

    def test_pas_de_remise_sous_le_seuil(self):
        self.assertEqual(remise(19.99), 0.0)

    def test_remise_au_seuil(self):
        self.assertEqual(remise(20.0), 2.0)

    def test_remise_au_dessus_du_seuil(self):
        self.assertEqual(remise(30.0), 3.0)

    def test_total_avec_remise(self):
        self.assertEqual(total([{"prix": 2.5, "quantite": 8}]), 18.0)


if __name__ == "__main__":
    unittest.main()
