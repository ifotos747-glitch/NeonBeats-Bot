# NeonBeats 2.4 — TITLES & MUSIC CONTROL

## Zmiany
- `/play` z linkiem YouTube pobiera prawdziwy tytuł z publicznych metadanych oEmbed, z krótkim limitem czasu i cache 6 godzin.
- Wpis „Teraz gra”, `/nowplaying` oraz nowa kolejka pokazują nazwę filmu, a nie samo ID, kiedy metadane są dostępne.
- Po faktycznym rozpoczęciu odtwarzania Discord Voice bot automatycznie pokazuje **NEONBEATS • MUSIC CONTROL** z nazwą utworu i dotychczasowymi przyciskami.
- Panel jest jeden na sesję i kanał tekstowy: przy zmianie utworu jest aktualizowany, zamiast wysyłania wielu paneli.
- Pobieranie tytułu nie uruchamia dodatkowego yt-dlp. Przy awarii metadanych nadal gra audio, a bot używa identyfikatora jako awaryjnego tytułu.

## Wdrożenie ALTARE
Zastąp `src/youtube.js`, `src/bot.js`, `src/player.js`, `package.json`; testy `tests/youtube.test.js` i nowy `tests/music-control.test.js` są opcjonalne na hostingu. Zachowaj `.env`, `bin/`, `data/`, `music/`.
Zrestartuj bota. Nie trzeba ponownie uruchamiać `npm run register`, ponieważ komendy nie zmieniły nazw.

## Test
1. Wpisz `/play` i link publicznego remiksu.
2. Sprawdź tytuł wiadomości „NeonBeats teraz gra”, `/nowplaying` i panel MUSIC CONTROL.
3. Zmień utwór i sprawdź, czy istniejący panel się aktualizuje.
4. Sprawdź przyciski Pause, Resume, Skip, Volume.
5. Przetestuj odtwarzanie na kilku serwerach; panel powinien być osobny dla sesji każdego serwera.

oEmbed może zwrócić brak tytułu dla niektórych filmów, ograniczeń regionalnych i hostingu. Nie jest to błąd silnika yt-dlp i nie powinno blokować muzyki.
