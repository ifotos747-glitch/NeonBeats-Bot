# NeonBeats 2.2.1 — naprawa błędu PYI-126 w yt-dlp

Błąd `Failed to extract Cryptodome/Cipher/_ARC4.abi3.so` pochodzi z rozpakowywania bibliotek samodzielnego programu yt-dlp przez PyInstaller. Nie oznacza problemu z wybranym remiksem.

## Diagnostyka ALTARE
1. Zatrzymaj bota, sprawdź wolne miejsce oraz limity przestrzeni dyskowej i katalogu tymczasowego na hostingu.
2. Jeśli masz terminal, sprawdź `df -h /tmp`, `df -i /tmp` i `./bin/yt-dlp_linux --version`. Nie usuwaj innych plików użytkowników z katalogów współdzielonych.
3. Jeśli możesz wskazać inny, istniejący i zapisywalny katalog z odpowiednią ilością wolnego miejsca, ustaw w prywatnym `.env` lub panelu zmiennych środowiskowych `YTDLP_TMPDIR=/absolutna/sciezka`. Katalog musi pozwalać na ładowanie plików wykonywalnych/bibliotek (nie może mieć `noexec`). Następnie uruchom ponownie bota.
4. Sprawdź `/youtube status`, `/youtube napraw`, `/youtube diagnoza url:<link>`.
5. Jeśli błąd nadal występuje, plik yt-dlp może być uszkodzony albo hosting ogranicza rozpakowywanie. Skontaktuj się z administratorem ALTARE, podając błąd PYI-126 (bez tokenu bota).

## Pliki do wdrożenia
Zastąp: `src/youtube.js`, `package.json`, opcjonalnie `.env.example` (NIE nadpisuj prywatnego `.env`); dla testów `tests/youtube.test.js`.

Aktualizacja rozpoznaje błąd, przekazuje TMPDIR do procesu yt-dlp i wyświetla czytelną diagnozę. Nie usuwa ograniczeń dyskowych, nie naprawia fizycznie uszkodzonego binarium i nie obchodzi ograniczeń YouTube.
