# NeonBeats 2.3.2 — naprawa yt-dlp / błędu PYI

## Co potwierdziliśmy
Błąd `[PYI-140:ERROR] Failed to extract Cryptodome/Cipher/_ARC4.abi3.so` i kod `255` występują podczas rozpakowywania programu yt-dlp. Nie jest to awaria formatu audio remiksów, a zwykły test `/testaudio` działa.

## Co zmieniono
- Domyślnie NeonBeats tworzy własny katalog `data/yt-dlp-temp` i wskazuje go jako TMPDIR/TEMP/TMP dla uruchamianego yt-dlp. Katalog jest tworzony na dysku hostingu, a nie w Discordzie.
- Komendy `/youtube status` i `/youtube napraw` pokazują katalog tymczasowy oraz szacowane wolne miejsce widziane z procesu Node.js. Uwaga: quota hostingu może być mniejsza niż raport systemu plików.
- Po błędzie PyInstaller/PYI kod 255 bot nie próbuje na ślepo innych formatów audio.
- Zachowano radio globalne, playlisty, wcześniejszy hotfix i muzykę lokalną.

## Instalacja ALTARE
1. **Zachowaj** prywatny `.env`, `data/`, `music/`, `bin/` (zrób backup).
2. Nadpisz `src/youtube.js`, `src/player.js`, `src/bot.js` i `package.json`. Nie trzeba rejestrować komend ponownie.
3. Zrestartuj proces bota. Bot spróbuje sam utworzyć `data/yt-dlp-temp` przy pierwszym sprawdzeniu yt-dlp.
4. Uruchom na Discordzie `/youtube status`, `/youtube napraw` i `/play` z publicznym utworem.
5. Jeśli folder `data/yt-dlp-temp` ma zakaz uruchamiania bibliotek (`noexec`) lub brak miejsca, yt-dlp nadal nie zadziała. Wtedy panel ALTARE musi udostępnić właściwy katalog lub administrator hostingu musi pomóc. W istniejącym prywatnym `.env` możesz wskazać **istniejący** i zapisywalny katalog absolutną ścieżką przez `YTDLP_TMPDIR`. Wartość `system` wyłącza dedykowany folder i przywraca systemowe TMPDIR.

Nie usuwaj współdzielonego `/tmp`, nie wgrywaj tokenów i nie traktuj wyników testów GitHub jako potwierdzenia naprawy ograniczeń ALTARE.
