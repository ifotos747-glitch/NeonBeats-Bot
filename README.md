# 🎧 NeonBeats Bot 1.0 — NEON GENESIS

Nowy, niezależny bot muzyczny Discord. **Nie jest kopią konta ani tokena BOBER MUSIC BOT.**

## Funkcje

- Muzyka z własnych plików MP3, WAV, OGG i legalnie udostępnionych strumieni HTTP(S).
- Kolejka muzyki, pauza/wznów, pomijanie, głośność, panel sterowania z przyciskami.
- Radio internetowe: zapis własnych stacji, odtwarzanie i zatrzymywanie.
- Tryb **24/7**: radio / AutoDJ / ciche czuwanie. Ustawienia zapisane w data/.
- **AutoDJ** automatycznie odtwarza własne pliki z music/.
- Efekty DJ: bass, nightcore, slowed, 8d, echo, club.
- Playlisty zapisane osobno dla serwerów Discord.
- Bezpieczna klasyfikacja URL i ochrona przed adresami lokalnymi.
- Testowy, oryginalny dźwięk `music/demo.wav` i testy GitHub Actions.

## Wymagania

Node.js **24.17 lub nowszy**, Discord bot token oraz możliwość uruchomienia FFmpeg. Darmowy hosting 24/7 musi naprawdę działać ciągle i utrzymywać trwałe pliki data/; limity hostingu mogą ograniczyć funkcje.

## Uruchomienie

1. Wejdź na https://discord.com/developers/applications → **New Application** → **NeonBeats Bot**.
2. Otwórz **Bot**, utwórz token nowej aplikacji i zachowaj go prywatnie.
3. Skopiuj plik `.env.example` jako `.env` (tylko na hostingu / komputerze).
4. Wypełnij `DISCORD_TOKEN`, `CLIENT_ID` (Application ID nowej aplikacji) i `GUILD_ID` (ID Twojego serwera Discord).
5. Zaproś nowego bota na serwer z zakresami **bot** i **applications.commands** oraz uprawnieniami Connect, Speak, Send Messages i View Channels.
6. W panelu hostingu ustaw Node.js 24+, plik startowy `index.js` lub polecenie `npm start`.
7. Uruchom `npm install --no-audit --no-fund`, następnie `npm start`.
8. Na Discordzie wykonaj `/status`, `/testaudio`, `/panel`, `/neonhelp`.

### Testy

```bash
npm install --no-audit --no-fund
npm run check
```

GitHub Actions uruchamia testy przy push i pull request.

### Najważniejsze komendy

| Obszar | Komendy |
| --- | --- |
| Muzyka | `/play source:demo.wav`, `/queue`, `/skip`, `/stop`, `/pause`, `/resume` |
| Diagnostyka | `/status`, `/testaudio`, `/files` |
| Panel | `/panel`, `/nowplaying`, `/volume` |
| Radio | `/radio add`, `/radio list`, `/radio play`, `/radio stop`, `/radio diagnoza` |
| 24/7 | `/247 on`, `/247 off`, `/247 status` |
| AutoDJ | `/autodj on`, `/autodj off` |
| Efekty | `/dj preset`, `/dj off`, `/dj status` |
| Playlisty | `/playlist save`, `/playlist load`, `/playlist list`, `/playlist delete` |

**Uwaga o YouTube i Spotify:** NeonBeats rozpoznaje adresy obu usług, ale ich API nie dostarczają audio do nadawania na kanale Discorda. Komenda `/play` nie obchodzi blokady sesji ani zabezpieczeń YouTube/Spotify. Korzystaj z muzyki i strumieni, do których odtwarzania i retransmisji masz prawo.

**Bezpieczeństwo:** nigdy nie dodawaj prywatnego `.env`, tokenów Discord ani plików z folderu `data/` do GitHuba. Nie używaj tokena BOBER MUSIC BOT — NeonBeats wymaga osobnej aplikacji Discord.

### Diagnostyka radia (1.0.1)

Użyj `/radio diagnoza nazwa:<nazwa stacji>` dla zapisanej stacji. Komenda testuje 5 sekund audio przez FFmpeg z limitem czasu 20 sekund i pokazuje liczbę odebranych bajtów oraz odfiltrowany dziennik błędu. Wymaga uprawnienia Zarządzanie serwerem. Nie zmienia kolejki ani trybu 24/7.

### Diagnostyka 1.0.2

`/radio diagnoza` przeprowadza jednocześnie próbę pobrania pięciu sekund audio ze stacji i lokalny test dźwięku generowanego przez FFmpeg (bez sieci). Oprócz kodu zakończenia i liczby bajtów pokazuje sygnał zakończenia (np. SIGKILL), czas próby i przekroczenie limitu. Jeśli test lokalny działa, a test stacji nie, FFmpeg potrafi generować audio, ale to nie dowodzi jeszcze, dlaczego strumień jest niedostępny. Test nie nadaje muzyki na Discordzie.

### Diagnostyka HTTP (1.0.3)

Komenda `/radio diagnoza` dodatkowo wykonuje z ALTARE test HTTP przy użyciu Node.js, niezależny od FFmpeg. Pokazuje kod HTTP, typ odpowiedzi, liczbę pierwszych odebranych bajtów, host docelowy przekierowania i uproszczony błąd sieciowy. Nie podaje pełnych adresów ani tokenów w wiadomościach Discorda. Test HTTP nie podąża za przekierowaniami; przekierowanie 3xx jest informacją diagnostyczną, a nie dowodem awarii sieci.


### Poprawka radia 1.0.4 — przekierowania i SIGSEGV

Podczas testów na ALTARE pojawił się kod HTTP 302 oraz awaria FFmpeg z sygnałem SIGSEGV podczas otwierania URL. Dla zwykłych strumieni MP3/AAC i plików audio NeonBeats pobiera teraz HTTP przez Node.js, waliduje adres przy każdym przekierowaniu (maks. pięć) i przesyła dane do FFmpeg wejściem pipe:0. To omija sieciową część FFmpeg, która uległa awarii. Linki do playlist HLS/M3U/PLS zachowują dotychczasową obsługę przez FFmpeg. Diagnostyka HTTP sprawdza teraz końcową odpowiedź po przekierowaniach. Jeśli źródło zwraca HTML, błąd 403 lub nie dostarcza danych audio, bot pokaże błąd zamiast pozornego odtwarzania. Nie oznacza to automatycznie uprawnienia do retransmisji strumienia.


### NeonBeats 1.1.0 — YouTube (beta)

Komenda `/play source:<URL YouTube>` dodaje do kolejki pojedynczy film YouTube i próbuje odtwarzać audio przez yt-dlp → FFmpeg → Discord. Zachowane są funkcje radia, AutoDJ i lokalnych plików.

Na ALTARE uruchom bota z Node.js 24, następnie jako administrator serwera Discord wykonaj `/youtube install`. Bot pobierze oficjalne yt-dlp_linux 2026.10.26 (około 40 MB) do folderu bin/, sprawdzi SHA-256 i ustawi uprawnienia. Hosting musi pozwolić pobrać i uruchomić ten plik. Zamiast tego możesz ustawić `YTDLP_PATH` w prywatnym `.env`.

Nowe komendy: `/youtube install`, `/youtube status`, `/youtube diagnoza url:<link>` (instalacja i diagnoza wymagają Zarządzania serwerem). Linki pojedynczych filmów: watch, youtu.be, shorts i live; playlisty nie są importowane. yt-dlp używa Node.js jako środowiska JavaScript przez `--js-runtimes node:<ścieżka>`. Nie podawaj cookies ani prywatnego logowania. YouTube może ograniczać dostęp z IP hostingu; skuteczność na ALTARE wymaga testów. Odtwarzaj tylko materiały, do których masz stosowne prawa.
