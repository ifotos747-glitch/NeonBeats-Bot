# NEONBEATS — TEST HOSTINGÓW A/B (3.7.14)

Celem jest rozróżnienie wpływu hostingu/ścieżki UDP na drobne zakłócenia głosu Discord, które nadal występują mimo pełnego bufora Opus i poprawnych lokalnych metryk.

## Zasady

- **Ten sam bot, token, wersja, stacja, profil i kanał Discord.**
- **Tylko jedna kopia bota w danym momencie**; przed startem na drugim hostingu zatrzymaj instancję na pierwszym.
- **Nie kopiuj prywatnego .env do GitHub**. Umieść go tylko w prywatnych panelach hostingów. Używaj osobnego tokena testowego tylko przy tworzeniu osobnego bota; w porównaniu tego samego bota korzystaj z istniejącego tokena.
- Profil startowy: `NEONBEATS_RADIO_CODEC=opus`, `NEONBEATS_RADIO_OPUS_PROFILE=robust`, `NEONBEATS_RADIO_PREBUFFER_MS=2000`.
- Nie zmieniaj poziomu głośności, efektów DJ, kanału, regionu ani klienta Discord między próbami.
- Jeśli zmiana hostingu nie pomaga, hipoteza o trasie ALTARE→Discord nie jest potwierdzona.

## A — ALTARE

1. Zanotuj bieżącą wersję, stację i `/status`. Zatrzymaj radio i uruchom je ponownie, by liczniki zaczęły od nowa.
2. Dodaj w **prywatnym** `.env`:
   ```dotenv
   NEONBEATS_HOST_LABEL=ALTARE
   NEONBEATS_RADIO_CODEC=opus
   NEONBEATS_RADIO_OPUS_PROFILE=robust
   NEONBEATS_RADIO_PREBUFFER_MS=2000
   IDLE_MINUTES=0
   ```
3. Zrestartuj bot na ALTARE, uruchom ESKA na tym samym kanale i posłuchaj 10–15 minut. Zanotuj liczbę słyszalnych przycięć; pobierz `/status` po próbie.
4. Powtórz próbę dla Radio Club Dj. Potem **zatrzymaj serwer bota na ALTARE całkowicie**.

## B — drugi hosting, np. osobne wdrożenie Bot-Hosting.net

1. Utwórz **osobne wdrożenie Node.js 24** (nie nadpisuj katalogu innego bota). Prześlij aktualne repo GitHub jako ZIP i rozpakuj do katalogu głównego, z `index.js` i `package.json` obok siebie. **Nie wgrywaj `node_modules`**.
2. Panel Startup: plik startowy `index.js` lub komenda `node index.js` w zależności od panelu. Zainstaluj zależności zgodnie z instrukcją hostingu (`npm install`, jeśli instalacja nie jest automatyczna).
3. W nowym prywatnym `.env` skonfiguruj takie same `DISCORD_TOKEN`, `CLIENT_ID`, oraz inne wymagane ustawienia, **z wyjątkiem** etykiety:
   ```dotenv
   NEONBEATS_HOST_LABEL=BOT-HOSTING
   NEONBEATS_RADIO_CODEC=opus
   NEONBEATS_RADIO_OPUS_PROFILE=robust
   NEONBEATS_RADIO_PREBUFFER_MS=2000
   IDLE_MINUTES=0
   ```
4. Jeśli na ALTARE jest ustawione 24/7, przenieś kopię wymaganych plików serwera z prywatnego `data/` **tylko w razie potrzeby**; nie nadpisuj katalogu danych innego bota. Stacje globalne mogą wymagać przeniesienia ich plików bazy, zależnie od konfiguracji NeonBeats. Dla testów możesz uruchomić rozpoznawalną stację bez kopiowania innych danych.
5. Uruchom jedynie drugą kopię. W `/status` sprawdź **Hosting testowy: BOT-HOSTING** i ten sam profil `ROBUST 96 kb/s`.
6. Posłuchaj tych samych dwóch stacji po 10–15 minut, przy tych samych ustawieniach, i zanotuj liczbę przycięć oraz `/status`.

## Porównanie

| Przebieg | Hosting | Stacja | Czas próby | Liczba przycięć | Bufor min. | Opus underruns | Voice bez ramki | Dispatch failed |
|---|---|---|---|---|---|---|---|---|
| A1 | ALTARE | ESKA | 15 minut | | | | | |
| A2 | ALTARE | Radio Club Dj | 15 minut | | | | | |
| B1 | BOT-HOSTING | ESKA | 15 minut | | | | | |
| B2 | BOT-HOSTING | Radio Club Dj | 15 minut | | | | | |

Nie traktuj `dispatchSuccess` jako potwierdzenia odbioru pakietu przez Discord. Brak błędów w `/status` **nie wyklucza utraty UDP** na trasie lub przy odbiorze klienta.

Po eksperymencie pozostaw tylko jeden wybrany hosting uruchomiony; zatrzymaj drugi. `IDLE_MINUTES=0` nie zapewnia ponownego dołączenia do kanału po restarcie hostingu: to osobna funkcja 24/7.
