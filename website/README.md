# Oficjalna strona NeonBeats 2.5

Strona znajduje się w katalogu `website/`.

## Cloudflare Pages
1. Pobierz folder `website/` albo ZIP strony.
2. W Cloudflare wybierz **Workers & Pages → Create / Utwórz → Pages** i **Upload assets / Prześlij zasoby**.
3. Prześlij plik `index.html` jako plik główny albo ZIP, jeśli interfejs Cloudflare akceptuje ZIP.
4. Cloudflare przydzieli adres `*.pages.dev`. Możesz podłączyć własną domenę.

Strona nie wymaga Node.js, bazy danych ani serwera API. Jest osobna od procesu bota na ALTARE.

## Zaproszenie do bota
Wszystkie przyciski zaproszenia prowadzą pod adres podany przez właściciela:
https://discord.com/oauth2/authorize?client_id=1471988860828516423

## Czego strona nie robi
Nie wyświetla niezweryfikowanego statusu online ani prawdziwych statystyk bota. Widok MUSIC CONTROL jest demonstracją; przyciski odtwarzania działają wyłącznie w Discordzie.

## Bezpieczeństwo
Nie publikuj `.env`, tokenów Discorda, folderu `data/` ani plików ALTARE. Do Cloudflare wgrywaj wyłącznie pliki z `website/`.
