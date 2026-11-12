# NeonBeats 3.0 — WEB CONTROL (Cloudflare + ALTARE)

To jest **prawdziwe zdalne sterowanie** botem z przeglądarki: logowanie Discord OAuth2, wybór serwera z uprawnieniem **Zarządzanie serwerem**, podgląd aktualnego utworu/kolejki, pauza, wznowienie, pomiń, stop, losowanie, powtarzanie, głośność, DJ, dodawanie publicznego linku YouTube i przełączanie globalnej stacji.

Wersja 3.0 nie usuwa funkcji 2.5: Youtube, remixy, radio globalne, AutoDJ, 24/7, panel Discord.

## Architektura

- **Cloudflare Worker**: publiczna strona NeonBeats + prywatne API zabezpieczone logowaniem Discord OAuth.
- **Cloudflare D1**: sesje OAuth, stan serwerów i kolejka poleceń (bez tokena bota).
- **ALTARE**: proces NeonBeats wykonuje wyłącznie **wychodzące HTTPS** do Cloudflare co 3 sekundy. Nie wymagamy otwartego portu ani publicznego serwera WWW na ALTARE.
- **Discord**: zakresy OAuth \`identify guilds\`, sprawdzanie praw Manage Guild / Administrator, wybór serwera, na którym bot jest połączony.
- **Bezpieczeństwo**: nigdy nie wrzucaj tokenów ani sekretów OAuth do GitHub; sekret mostu musi być losowy i identyczny w Cloudflare i ALTARE.

> **Uwaga:** `wrangler.jsonc` jest konfiguracją narzędzia wdrożeniowego, a nie stroną do przesłania jako plik. Wdrożenie wykonaj poleceniem `npx wrangler deploy --config web-control/wrangler.jsonc` z katalogu głównego projektu.

## 1. D1 w Cloudflare

Na komputerze Windows z Node.js otwórz PowerShell, pobierz repozytorium i przejdź do katalogu projektu.

Zaloguj Wrangler:

\`\`\`powershell
npx wrangler login
\`\`\`

Utwórz bazę:

\`\`\`powershell
npx wrangler d1 create neonbeats-control
\`\`\`

Cloudflare zwróci \`database_id\`. W pliku \`web-control/wrangler.jsonc\` zastąp \`REPLACE_WITH_YOUR_D1_DATABASE_ID\` zwróconym ID (to nie jest sekret).

Wykonaj SQL:

\`\`\`powershell
npx wrangler d1 execute neonbeats-control --remote --file=web-control/schema.sql
\`\`\`

## 2. Adres strony i OAuth Discord

Strona 3.0 musi działać jako **Cloudflare Worker ze Static Assets**, ponieważ sam upload HTML do Cloudflare Pages NIE uruchomi API.

Ustal docelowy adres Workera, np. \`https://neonbeats-web-control.TWOJ-SUBDOMAIN.workers.dev\` (sprawdź rzeczywisty adres w Cloudflare, nie zgaduj). W \`web-control/wrangler.jsonc\` ustaw:

\`\`\`toml
PUBLIC_ORIGIN = "https://neonbeats.ifotos747.workers.dev"
\`\`\`

W [Discord Developer Portal](https://discord.com/developers/applications) otwórz aplikację NeonBeats, **OAuth2 → Redirects** i dodaj:
\`https://neonbeats.ifotos747.workers.dev/auth/callback\`

Client ID NeonBeats jest już ustawione w konfiguracji: \`1471988860828516423\`. Client Secret odnajdziesz w OAuth2, nie publikuj go.

## 3. Sekrety Cloudflare Worker

W PowerShell wywołaj osobno:

\`\`\`powershell
npx wrangler secret put DISCORD_CLIENT_SECRET --config web-control/wrangler.jsonc
npx wrangler secret put BRIDGE_SECRET --config web-control/wrangler.jsonc
\`\`\`

Pierwszy to sekret Discord OAuth2. Drugi to nowy, losowo wygenerowany klucz długości **minimum 32 znaków** (zalecane 64 znaki szesnastkowe). Przykład generowania w Node.js:

\`\`\`powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

Zapisz ten drugi klucz bezpiecznie (nie w repo i nie wysyłaj na czat). Powtórz go w ALTARE pod nazwą \`NEONBEATS_CONTROL_SECRET\`.

## 4. Opublikuj stronę i API

\`\`\`powershell
npx wrangler deploy --config web-control/wrangler.jsonc
\`\`\`

Gdy wdrożenie pokaże URL Workera, sprawdź, czy jest **dokładnie równy** \`PUBLIC_ORIGIN\`; w przeciwnym razie popraw zmienną i redirect w Discord i wdroż ponownie.

Sprawdź \`https://ADRES-WORKERA/api/health\`. Powinno zwrócić JSON z \`ok: true\`.

## 5. ALTARE

Wgraj do bota nowe \`src/web-control.js\`, \`src/bot.js\` i \`package.json\`. Zachowaj prywatne \`.env\`, \`data/\`, \`music/\`, \`bin/\`.

W istniejącym \`.env\` ALTARE dodaj:

\`\`\`dotenv
NEONBEATS_CONTROL_URL=https://neonbeats.ifotos747.workers.dev
NEONBEATS_CONTROL_SECRET=TU_TEN_SAM_LOSOWY_BRIDGE_SECRET
\`\`\`

Uruchom ponownie bota. W logach NeonBeats nie powinno być błędu \`Web Control: HTTP 401\`. Sekret bota \`DISCORD_TOKEN\` nigdy nie trafia do Worker.

## 6. Test

1. Na Discordzie zaproś już działającego bota na serwer, którym zarządzasz.
2. Dołącz do kanału głosowego i odtwórz utwór poleceniem \`/play\`, aby bot wszedł na głos.
3. W przeglądarce otwórz \`https://ADRES-WORKERA/dashboard\` i kliknij **Zaloguj przez Discord**.
4. Wybierz serwer, sprawdź tytuł, kolejkę i głośność. Kliknij **Pauza**, **Wznów**, **Pomiń**, **Dodaj utwór**.
5. Sprawdź, czy stan na Discordzie odpowiada stronie.

Bez konfiguracji Worker+D1+sekretów przycisk Web Control na statycznej stronie NIE będzie funkcjonalny. Nie twierdź, że system połączono przed wdrożeniem.

## Ograniczenia i zalecenia

- W tym wydaniu panelem WWW steruje administrator / osoba z prawem Manage Guild lub właściciel serwera. Pozostali członkowie nie mają dostępu.
- Bot musi być już podłączony do kanału głosowego. Zarządzanie łączeniem z kanałem pozostaje na Discordzie.
- To jest sterowanie **z przeglądarki**, nie streaming audio do przeglądarki.
- OAuth access token trzymany jest po stronie D1, nie w przeglądarce. Zabezpiecz Cloudflare i regularnie zmieniaj sekrety.
- Przeciążenia ALTARE i ograniczenia YouTube wciąż mogą wpływać na dostępność odtwarzania.
- D1 snapshoty odświeżane są tylko gdy stan się zmieni lub minie 15 sekund, aby oszczędzać limity Cloudflare.
- Nie uruchamiaj równocześnie dwóch kopii bota z tym samym BRIDGE_SECRET, bo mogłyby wykonywać polecenia z różnych procesów.
