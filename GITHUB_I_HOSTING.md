# NeonBeats 1.0 — GitHub i hosting krok po kroku

## Krok 1: Discord Developer Portal

1. Otwórz https://discord.com/developers/applications.
2. Utwórz **nową** aplikację o nazwie **NeonBeats Bot**.
3. Zakładka **Bot**: utwórz token; nie publikuj go w repozytorium.
4. Zakładka **General Information**: skopiuj Application ID (to `CLIENT_ID`).
5. Otwórz serwer Discord i skopiuj jego ID (`GUILD_ID`).
6. Zakładka **Installation** lub OAuth2: dodaj zakresy `bot`, `applications.commands`, prawa Connect/Speak/Send Messages/View Channels. Zaproś bota.

## Krok 2: Hosting (Node.js)

- Repozytorium: `ifotos747-glitch/NeonBeats-Bot`; gałąź: `main`.
- Startup file: `index.js`; Node.js: 24.17+.
- Polecenie instalacji: `npm install --no-audit --no-fund`.
- Polecenie startu: `npm start` albo `node index.js`.
- Plik `.env` (prywatny!): `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`. Inne ustawienia z `.env.example` są opcjonalne.
- Przy aktualizacjach zabezpieczaj folder `data/`, `music/` i plik `.env`.

## Krok 3: Testy

1. Konsola: oczekiwane uruchomienie i rejestracja komend.
2. Discord: `/status` i `/testaudio`.
3. `/panel` i kontrolki Pause/Resume/Skip.
4. `/dj preset` i `/playlist save`.
5. Dodaj dozwolony strumień `/radio add`, przetestuj `/radio play`.
6. Włącz 24/7 poleceniem `/247 on`; sprawdź po restarcie `/247 status`.

Nie uruchamiaj jednocześnie dwóch instancji **tego samego** bota Discord z identycznym tokenem. BOBER MUSIC BOT jest osobną aplikacją i może pozostać uruchomiony.

YouTube i Spotify: oficjalne API nie służą do retransmisji muzyki na Discordzie; nowa aplikacja nie gwarantuje obejścia blokady hostingu.
