# NeonBeats — oficjalna strona + Web Control 3.0

Strona `website/index.html` i panel `website/dashboard.html` są przygotowane do wspólnego hostingu na **Cloudflare Worker Static Assets**.

Sam upload HTML na Cloudflare Pages pozwoli zobaczyć szatę graficzną, ale **nie uruchomi sterowania botem**. Do działającego panelu potrzebne są konfiguracja Discord OAuth2, D1 i most ALTARE–Cloudflare.

## Konfiguracja i wdrożenie

Pełna instrukcja: [web-control/README.md](../web-control/README.md).

Link zaproszenia bota:
https://discord.com/oauth2/authorize?client_id=1471988860828516423

Nie przesyłaj do Cloudflare jako publicznych zasobów plików .env, tokenów, danych ALTARE ani bazy.
