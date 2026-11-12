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


### NeonBeats 1.2.0 — playlisty YouTube

Dodaj playlistę przez `/youtube playlista url:<link>` albo `/play source:<link do playlisty>`. Obsługiwane są playlisty na youtube.com, music.youtube.com oraz linki do filmów z parametrem `list=`. yt-dlp używa `--flat-playlist --dump-json --playlist-end 50`, czyli pobiera metadane pierwszych maksymalnie 50 pozycji bez zapisywania filmów. NeonBeats dodaje dostępne filmy do kolejki w kolejności playlisty i odtwarza je kolejno przez sprawdzony już silnik YouTube 1.1.0. Wewnętrzna kolejka ma limit 100 utworów. Komendy `/queue`, `/skip`, `/pause`, `/resume` oraz lokalne `/playlist save|load` nadal działają. Poza publicznymi materiałami nie ma wsparcia dla prywatnych playlist wymagających logowania lub cookies. Można otrzymać krótszą listę, jeśli filmy są usunięte, prywatne lub niedostępne na ALTARE. Import playlisty nie pobiera jej muzyki do plików. Obowiązują zasady dostępu i prawa do odtwarzania oraz retransmisji.


### NeonBeats 1.2.1 — zgodność playlist YouTube

Importer odczytuje maksymalnie 100 pozycji naraz, z możliwością wyboru zakresu: `/youtube playlista url:<link> od:1 ile:100`, potem `od:101 ile:100`. Obsługiwane są różne warianty metadanych płaskich playlist (`id`, `url`, `webpage_url`), w tym pozycje bez tytułu. Bot nie odrzuca utworów tylko ze względu na niepełne metadane i pokazuje osobno liczbę jawnie niedostępnych pozycji, nierozpoznanych identyfikatorów i nieprawidłowych danych. Niektóre pozycje mogą być pominięte już przez YouTube/yt-dlp bez przekazania JSON; raport dotyczy odebranych pozycji, a nie gwarantowanej całkowitej liczby playlisty. W odtwarzaniu pojedynczych filmów zwiększono tolerancję na przejściowe błędy sieci dzięki ograniczonej liczbie ponownych prób yt-dlp. Filmy prywatne, usunięte, DRM lub wymagające logowania nadal mogą być nieodtwarzalne. Nie używaj cookies ani prób obchodzenia blokad YouTube.

Dla filmów YouTube odtwarzacz czeka teraz maksymalnie 90 sekund na pierwsze audio (zamiast wcześniejszych 30 sekund), aby nie odrzucać utworów tylko z powodu wolniejszego odczytu metadanych lub startu transmisji na hostingu. Pozostałe źródła zachowują 30-sekundowy limit.

## NeonBeats 3.7 — FASTSTREAM (wydajność i zgodność)

- `/play` dla YouTube natychmiast dodaje utwór, a jego tytuł pobiera asynchronicznie; publiczne metadane nie opóźniają startu audio ani odpowiedzi Discord.
- Web Control wykonuje komendy niezależnie dla każdego serwera (jednocześnie między serwerami, w kolejności wewnątrz jednego serwera). Zmniejszono liczbę odczytów JSON podczas odświeżania.
- Panel Discord łączy szybkie zmiany w jeden nowszy stan i ogranicza częste edycje wiadomości (800 ms).
- Dla internetowego audio domyślnie używany jest krótki bufor PCM 280 ms (ustaw `NEONBEATS_PREBUFFER_MS=0` dla wyłączenia, 0–800 ms); wykrywanie zatrzymania danych po 30 sekundach aktywnego odtwarzania.
- Ręcznie uruchomione radio/strumienie mają maksymalnie trzy próby automatycznego ponowienia po błędach; radio 24/7 zachowuje własny mechanizm ponawiania. Discord Voice toleruje dłużej krótkie przerwy połączenia.
- YouTube nadal zależy od możliwości `yt-dlp`, zasobów ALTARE i ograniczeń samego YouTube. Nie wszystkie filmy mogą być odtwarzane; nie używaj cudzych cookies. Po instalacji sprawdź `/youtube status` i w razie potrzeby `/youtube aktualizuj`.

Zaktualizuj na ALTARE: `src/bot.js`, `src/player.js`, `src/web-control.js`, `src/premium.js`, `package.json`, `index.js` (oraz zachowaj `src/audio-buffer.js`, który jest już w repo). **Cloudflare Worker i strona WWW nie wymagają wdrożenia** dla tej aktualizacji. Zachowaj `.env`, `data/`, `music/`, `bin/`; ustawienia i licencje Premium zostają. Zrestartuj bota po zmianach.

## NeonBeats 3.7.1 — RADIO STABILITY

Naprawa przerw dźwięku przede wszystkim podczas radia online (Icecast / Shoutcast / strumienie HTTP):
- Biblioteka Discord Voice zwykle dopuszcza tylko 5 brakujących ramek PCM/Opus (około 100 ms), po czym kończy odtwarzanie. NeonBeats toleruje teraz maksymalnie 100 kolejnych braków ramek (~2 s ciszy) przed rozłączeniem zasobu. To nie odtwarza brakujących danych, lecz ogranicza kosztowne przerywanie i ponowne uruchamianie całego radia przy drobnych opóźnieniach.
- Oddzielny bufor startowy **radia i strumieni live**: domyślnie **1000 ms**, konfigurowalny przez `NEONBEATS_RADIO_PREBUFFER_MS` (0–3000). `NEONBEATS_PREBUFFER_MS` pozostaje ustawieniem m.in. YouTube (0–800).
- Kiedy stacja zamknie zwykłe połączenie HTTP bez błędu, NeonBeats traktuje to jako zerwanie radia i automatycznie próbuje odtworzyć ponownie.
- Ręcznie wybrane stacje otrzymują maks. trzy próby w ciągu 2 minut; po dłuższym okresie udanej pracy licznik prób jest resetowany. Radio 24/7 może wracać do nadawania po kolejnych przerwach, z rosnącym czasem oczekiwania, by nie przeciążać hostingu.
- `/status` pokazuje bieżący bufor radia i YouTube oraz tolerancję brakujących ramek. `/radio diagnoza` pomaga ocenić problemy konkretnej stacji.
- Komendy /radio, YouTube, Premium, zapisane playlisty oraz Web Control pozostają dostępne; Cloudflare nie wymaga ponownego wdrożenia.

**Aktualizacja ALTARE:** podmień `src/player.js`, `src/bot.js`, `package.json`, `index.js`. Pozostaw `.env`, `data/`, `music/`, `bin/`; jeśli wcześniejsze wydanie FASTSTREAM nie było zainstalowane w całości, pobierz cały aktualny katalog `src/` poza Twoimi danymi prywatnymi. Restart po zmianach. W `.env` możesz dodać `NEONBEATS_RADIO_PREBUFFER_MS=1000`; na szczególnie niestabilnym łączu spróbuj `1500`. Większa wartość wydłuża start, ale nie naprawi przeciążonego CPU ALTARE, złego adresu strumienia ani awarii rozgłośni.
