# NeonBeats 2.3 — PLAYLIST & AUDIO STABILITY

## Naprawione
- Import playlist uruchamia yt-dlp z tą samą konfiguracją `YTDLP_TMPDIR` co pojedyncze filmy. Wcześniej tego nie robił.
- Błąd `PYI-99`/Cryptodome podczas wczytywania playlisty jest rozpoznawany jako błąd silnika, a nie brak publicznych filmów.
- Odtwarzacz buforuje około 1,8 s zdekodowanego PCM przed rozpoczęciem utworu YouTube, żeby zmniejszyć ryzyko krótkich przycięć. Inne źródła: ~0,4 s.

## Pliki na hosting
Zastąp: `src/youtube-playlist.js`, `src/player.js`, `package.json`.
Dodaj: `src/audio-buffer.js`.
Testy (opcjonalne na hostingu): `tests/youtube-playlist.test.js` i `tests/audio-buffer.test.js`.

Zachowaj bez zmian `data/`, `music/`, `.env`, `bin/`. Zrób kopię danych przed zmianą.

Po wgraniu uruchom `npm install`, `npm run check` i zrestartuj bota. Nie trzeba ponownie rejestrować komend, ponieważ zestaw komend się nie zmienił.

## Jeśli PYI nadal występuje
To usterka wykonywania rozpakowywanego programu yt-dlp. Sprawdź, czy `YTDLP_TMPDIR` jest ustawione na **istniejący, zapisywalny** katalog z wolnym miejscem i możliwością uruchamiania bibliotek. Gdy brak powłoki ALTARE, poproś obsługę hostingu o diagnozę limitów `/tmp` i `noexec`.

Gdy audio nadal się zacina, porównaj radio, lokalny `/testaudio` i YouTube oraz sprawdź obciążenie CPU/RAM i sieć. Bufor maskuje krótkie skoki, nie naprawia trwale przeciążonego serwera.
