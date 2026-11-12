# NeonBeats 2.3.1 — YOUTUBE PLAYBACK HOTFIX

## Przyczyna możliwej regresji
W wersji 2.3 odtwarzacz czekał na około 1,8 sekundy surowego audio PCM przed rozpoczęciem Discord Voice. Na ograniczonych hostingach i przy wolnym rozpakowywaniu yt-dlp mogło to opóźniać lub zatrzymywać start wielu filmów YouTube.

Wersja 2.3.1 przywraca **natychmiastowy start Discord Voice** z FFmpeg i standardowe buforowanie strumieni Node/Discord. Nie cofa poprawki importera playlist z 2.3.

## Co wgrać na ALTARE
Zastąp tylko `src/player.js` i `package.json` z aktualnej gałęzi main. **Nie kasuj** `data/`, `music/`, `bin/`, `.env`. Nie trzeba usuwać `src/audio-buffer.js`: w tej wersji odtwarzacz już go nie wykorzystuje.

Zrestartuj proces bota. Nie trzeba ponownie rejestrować komend. Jeśli aktualizujesz zależności, użyj `npm install`.

## Testy
1. Discord: `/youtube status`
2. `/testaudio` — sprawdzenie Discord Voice / FFmpeg
3. `/play source:https://youtu.be/o-3chHNwg4c` — znany, uprzednio odtworzony remiks
4. `/play` z kilkoma innymi filmami
5. `/youtube playlista` — czy działa import metadanych

Jeśli błąd `PYI-99`, `PYI-126` lub `Cryptodome/Cipher/_ARC4.abi3.so` występuje nadal, jest to osobny problem uruchamiania binarium yt-dlp na hostingu, a nie mechanizmu bufora. Sprawdź wolne miejsce /TMPDIR i prawa hostingu. Jeśli pojedyncze filmy nie odtwarzają się po poprawce, zbierz konkretny komunikat z `/youtube diagnoza`.

Uwaga: GitHub Actions weryfikuje kod i testy jednostkowe, a nie rzeczywiste odtwarzanie przez ALTARE.
