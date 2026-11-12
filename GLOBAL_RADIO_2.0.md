# NeonBeats Global Radio 2.0

## Wdrożenie
1. Utwórz kopię zapasową folderu `data/`. **Nie kasuj plików JSON**: przechowują istniejące stacje i ustawienia serwerów.
2. Ustaw zmienną `BOT_OWNER_ID` na numeryczne Discord User ID właściciela bota.
3. Zainstaluj zależności: `npm install`.
4. Zarejestruj globalne komendy: `npm run register` (zmiany globalne mogą potrzebować czasu na synchronizację Discord).
5. Uruchom ponownie proces bota: `npm start`.
6. Migracja podczas startu przepisze istniejące stacje z lokalnych plików do jednego `data/global-radios.json`, bez kasowania oryginalnych zapisów. Stacje o tej samej nazwie są pomijane jako duplikaty.

## Komendy
- `/radio szukaj nazwa:<fraza>`: menu wyboru i odtwarzania na Twoim kanale głosowym.
- `/radio list`: pierwsze 25 stacji z globalnego katalogu.
- `/radio play nazwa:<nazwa>`: odtwarzaj stację.
- `/radio ulubione`: ulubione bieżącego serwera z menu odtwarzania.
- `/radio ulubione-dodaj nazwa:<nazwa>` i `/radio ulubione-usun nazwa:<nazwa>`: zarządzanie ulubionymi (wymaga Manage Server).
- `/radio admin dodaj|edytuj|usun`: zarządzanie stacjami globalnie, tylko właściciel `BOT_OWNER_ID`.
- Zachowane dla kompatybilności: `/radio add`, `/radio remove` (tylko właściciel bota), `/radio diagnoza`, `/radio stop`.
- `/247 on tryb:radio stacja:<nazwa>` używa katalogu globalnego.

**Ważne**: katalog działa globalnie między serwerami obsługiwanymi przez **jedną instancję bota** ze wspólnym trwałym folderem `data/`. Jeśli uruchamiasz wiele instancji na różnych hostach, zastosuj wspólną bazę danych, np. PostgreSQL lub Supabase. Nie zapisuj katalogu jedynie w nietrwałym katalogu kontenera.

## Test
`npm run check`, następnie test `/radio szukaj` na co najmniej dwóch serwerach i ulubione na każdym serwerze.
