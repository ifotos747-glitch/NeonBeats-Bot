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

## NeonBeats 3.7.2 — RADIO COMPATIBILITY

Dla stacji MP3 Icecast/Shoutcast, np. `http://4stream.pl:18272/stream` (Radio Club Dj), poprzednia komenda `/radio diagnoza` otwierała URL bezpośrednio w FFmpeg. Na niektórych hostingach ten sposób powoduje `SIGSEGV` już po kilkunastu milisekundach, mimo że HTTP Node.js zwraca poprawne `200 audio/mpeg`, a sam lokalny dekoder działa. Rzeczywisty odtwarzacz NeonBeats już wcześniej używał stabilniejszej ścieżki Node.js → FFmpeg `pipe:0`. Teraz diagnostyka korzysta z **tej samej ścieżki**, by diagnoza była miarodajna. Test jest ograniczony do trzech sekund przekodowanego audio i maksymalnie osiemnastu sekund oczekiwania. Błędy połączenia są raportowane bez ujawniania wrażliwych URL-i i tokenów.

**Wdrożenie ALTARE:** zaktualizuj `src/diagnostics.js`, `package.json` i `index.js` (jeżeli jesteś już na 3.7.1). Zrestartuj bota i ponownie uruchom `/radio diagnoza nazwa:Radio Club Dj`. Strona Cloudflare i D1 nie wymagają zmian. Zielony wynik potwierdzi, że Node→FFmpeg odczytuje i dekoduje dane; zacinanie w trakcie nadawania może nadal wynikać z łącza, serwera stacji, procesora hostingu lub Discord Voice — w tym wypadku sprawdź logi ALTARE podczas zacięcia.

## NeonBeats 3.7.3 — RADIO JITTER GUARD

Radio Club Dj and other live MP3 stations now use a **continuous 20 ms PCM jitter buffer** throughout playback, instead of only accumulating a short initial buffer. The bot keeps a bounded reservoir of decoded frames (up to around 6 seconds), applies backpressure to FFmpeg on fast input, and emits brief silence when incoming audio is temporarily unavailable. It waits for approximately 250–700 ms of recovered PCM before resuming the real signal, to avoid rapidly alternating tiny fragments and silence. This reduces unwanted player restarts and handles fluctuating streaming connections, but cannot replace missing broadcast packets. YouTube and local-file playback remain on their previous path.

The existing `NEONBEATS_RADIO_PREBUFFER_MS` setting remains 0–3000 ms; recommended 1000–1500 ms. `/status` now displays live radio buffer occupancy (ms), observed PCM underruns, and the total milliseconds of protective silence. If underruns grow during glitches, suspect unstable source transfer or host processing; if they remain zero while the user hears glitches, inspect Discord voice transport and ALTARE CPU limits.

On ALTARE update `src/audio-buffer.js`, `src/player.js`, `src/bot.js`, `package.json`, `index.js` (and when upgrading from earlier than 3.7.2 also `src/diagnostics.js`). Do not overwrite `.env`, `data/`, `music/` or `bin/`. Restart bot. No Cloudflare/SQL update required.

Test actual uninterrupted playback for 10–15 minutes and compare `/status` counters at the start and after audio glitches. GitHub tests validate buffer behavior but do not simulate actual ALTARE network/CPU conditions.

## NeonBeats 3.7.5 — RADIO TRACE

W teście `/testaudio` lokalny plik WAV grał płynnie na tym samym kanale Discord, podczas gdy Radio Club Dj miało niewielkie zakłócenia, a bufor PCM pozostawał pełny. Oznacza to, że warto odróżnić **odbiór i dekodowanie MP3** od samego połączenia głosowego; nie dowodzi to jeszcze jednej konkretnej przyczyny.

Nowy `/status` oprócz dotychczasowych statystyk wyświetla dla aktywnego radia:
- **MP3 HTTP:** liczba bajtów i porcji odczytanych z sieci przez Node.js;
- **Przerwy odczytu:** liczba odstępów pomiędzy otrzymanymi porcjami dłuższych niż 500 ms i 2000 ms oraz największy odstęp;
- **Ostrzeżenia FFmpeg:** licznik wykrytych ostrzeżeń i ostatni zanonimizowany komunikat o nieprawidłowych ramkach, uszkodzonych danych lub problemach dekodowania MP3.

**Interpretacja:** przerwy między odczytami mogą wynikać także z normalnego *backpressure* (przy pełnym buforze PCM odtwarzacz celowo ogranicza pobieranie), więc sama duża liczba przerw HTTP nie dowodzi usterki sieci. Ostrzeżenia o uszkodzonych ramkach MP3 są istotniejszym sygnałem. Liczniki są lokalne dla sesji i resetują się przy restarcie strumienia.

W 3.7.5 nie zmieniano algorytmu audio ani rozmiarów buforów — wydanie dodaje **pomiar problemu** bez niepotrzebnych zmian w stabilnym odtwarzaniu. ALTARE: podmień `src/network.js`, `src/player.js`, `src/bot.js`, dodaj `src/radio-health.js`, zaktualizuj `package.json` i `index.js`. Zachowaj `.env`, `data/`, `music/`, `bin/`. Cloudflare/D1 nie wymaga nowego wdrożenia.

Po restarcie posłuchaj tej samej stacji przez 10 minut i uruchom `/status` raz przed zauważonym zacięciem i drugi raz tuż po nim. Podaj szczególnie liczbę ostrzeżeń FFmpeg i nowych przerw odczytu MP3; sprawdź w osobnym teście jedną z pozostałych stacji globalnych, aby wykluczyć charakterystykę konkretnego MP3.

## NeonBeats 3.7.6 — NATIVE OPUS A/B (eksperymentalne)

Wspólny objaw: Radio Club Dj i ESKA lekko zacinają się, podczas gdy `/testaudio` (lokalny plik) działa płynnie. Raport 3.7.5 pokazał duży zapas PCM, brak niedoborów, brak błędów FFmpeg i brak dłuższych przerw HTTP. Nie wskazał przyczyny, dlatego nowa wersja udostępnia **porównanie dwóch torów kodowania radia** zamiast kolejnego zwiększenia bufora.

- **Domyślnie** `NEONBEATS_RADIO_CODEC=pcm` — dotychczasowe FFmpeg → 48 kHz stereo PCM → `@discordjs/voice` / `opusscript`, pełna zgodność z poprzednimi wersjami.
- **Tryb porównawczy** `NEONBEATS_RADIO_CODEC=opus` — FFmpeg dekoduje MP3 i koduje bezpośrednio do 128 kb/s Ogg/Opus (libopus, 48 kHz stereo, ramki 20 ms); NeonBeats buforuje skompresowany strumień przy starcie i przekazuje go jako `StreamType.OggOpus`, który Discord Voice demultipleksuje bez ponownego kodowania. Zmiana działa tylko dla `radio`/`stream`; YouTube i lokalne pliki są nietknięte.
- Tryb Opus używa `-af volume=...` FFmpeg zamiast JS inline volume; zmiana `/volume` restartuje bieżącą stację. Pozostałe efekty DJ nadal są wykonywane w FFmpeg. Jeśli FFmpeg lub Discord zwróci błąd Opus, sesja automatycznie wraca do PCM. W razie problemów ustaw PCM ręcznie i zrestartuj bota.
- `/status` podaje **Tryb radia: PCM / OPUS NATYWNY / PCM (powrót po błędzie)** oraz statystyki właściwego bufora.

**ALTARE:** wymień `src/player.js`, `src/opus-buffer.js` (nowy), `src/bot.js`, `package.json`, `index.js` z GitHub. Zostaw `.env`, `data/`, `music/`, `bin/` bez nadpisania; w swoim prywatnym `.env` dodaj `NEONBEATS_RADIO_CODEC=opus`, a następnie restart. Porównaj te same dwie stacje przez 10 minut z trybem PCM. Jeśli nadal tnie, odeślij `/status` i opis częstotliwości; nie deklarujemy usunięcia zakłóceń bez odsłuchu na ALTARE. Nie potrzeba zmian Cloudflare/SQL ani instalacji nowych pakietów npm dla tej funkcji — OggDemuxer dostarcza obecny `@discordjs/voice`.
