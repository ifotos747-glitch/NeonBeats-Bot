# NeonBeats 2.5 — SMOOTH PLAYBACK & MUSIC CONTROL

## Zmiany
- Kolejka: po naturalnym zakończeniu utworu odtwarzacz automatycznie uruchamia kolejny element (dotyczy plików, YouTube, remiksów i zapisanych playlist).
- `🔁 Powtarzanie` w panelu — powtarzanie bieżącego utworu, gdy dotrze do końca. Ręczne `Pomiń` przechodzi dalej także w tym trybie.
- `🔀 Losuj kolejkę` — przestawia oczekujące utwory, nie przerywając aktualnie odtwarzanego.
- `🔄 Odśwież` — odświeża istniejący panel.
- Rozbudowany MUSIC CONTROL wyświetla bieżący i następny utwór, rozmiar kolejki, głośność, efekt DJ, stan odtwarzania i powtarzanie.
- Zmniejszono liczbę wątków FFmpeg (2 dla dekodera i 1 dla filtra), aby ograniczyć zużycie CPU na hostingu ALTARE; nie stosowano ryzykownego wstrzymywania startu strumienia i buforowania PCM z wersji 2.3.
- Panel pozostaje jeden na sesję/kanał i jest edytowany po zmianie utworu i kolejek.
- Obsługa `yt-dlp`, własnego katalogu TMP, tytułów YouTube, globalnego radia i 24/7 pozostaje niezmieniona.

## Wdrożenie na ALTARE
1. Zrób kopię zapasową prywatnych `data/`, `music/`, `.env` i `bin/`.
2. Zastąp `src/player.js`, `src/bot.js`, `package.json`.
3. Uruchom ponownie bota. Nie trzeba uruchamiać `npm run register`, bo nowe przyciski MUSIC CONTROL nie są komendami slash.
4. Na Discordzie sprawdź: kolejkę z kilkoma filmami YouTube, naturalny koniec utworu, `⏭️ Pomiń`, `🔀 Losuj kolejkę`, `🔁 Powtarzanie`, zmiany głośności i panel.
5. W przypadku dłuższych zacięć sprawdź obciążenie CPU, sieć i logi ALTARE; redukcja wątków nie usunie wszystkich problemów hostingu.

## Ograniczenia
- Powtarzanie nie pobiera wstępnie całego materiału — nowy cykl YouTube może wymagać ponownego pobrania strumienia.
- Krótkie opóźnienie między filmami z YouTube może pozostać wskutek czasu pozyskiwania audio przez yt-dlp/FFmpeg.
- Automatyczne testy GitHub sprawdzają mechanikę kolejki i panel, ale nie prawdziwy Discord Voice na ALTARE.
