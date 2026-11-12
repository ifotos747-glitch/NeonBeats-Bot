# NeonBeats 2.2 — REMIX COMPATIBILITY

## Co naprawiono
- YouTube z trudniejszymi filmami i remiksami: trzy profile wyboru audio (standardowy, preferowany M4A, preferowany WebM/Opus).
- Przy błędzie kwalifikującym się do ponownej próby NeonBeats spróbuje **tego samego utworu ponownie przed następnym w kolejce**, zamiast odkładać go na koniec.
- Maksymalnie dwie dodatkowe próby na utwór; prywatne filmy, DRM, błędy 403/404 i blokady logowania nie są ponawiane.
- Nie usuwano istniejących funkcji globalnego radia, 24/7, playlist i efektów DJ.

## Wdrożenie na ALTARE
1. Zrób backup `data/`, `music/` i prywatnego `.env`.
2. Nadpisz `src/youtube.js`, `src/player.js` i `package.json`; opcjonalnie `tests/youtube.test.js` do lokalnych testów.
3. Uruchom `npm install` oraz `npm run check`. Restart procesu bota.
4. Na Discord użyj `/youtube status`, `/youtube aktualizuj` (administrator) i `/youtube diagnoza url:<link>` dla problematycznego remiksu.
5. Przetestuj `/play source:<link>` i obserwuj komunikaty o alternatywnym formacie.

Jeśli konkretny film nadal nie działa, do diagnozy potrzebny jest jego publiczny URL oraz komunikat `YouTube — błąd audio` z bota. Nie wysyłaj tokenów ani ciasteczek.

Zmiany nie gwarantują odtworzenia materiałów z ograniczonym dostępem (region, prywatność, logowanie, blokada IP, prawa lub DRM) i nie obchodzą zabezpieczeń YouTube.
