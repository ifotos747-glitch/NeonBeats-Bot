# NeonBeats 2.1 — COMPATIBILITY UPDATE

Aktualizacja zachowuje globalne radio 2.0, ulubione, AutoDJ, playlisty, DJ FX oraz 24/7.

## Zmiany
- /youtube aktualizuj: aktualizuje istniejący lokalny binarny yt-dlp do stabilnej wersji przez mechanizm aktualizacji samego yt-dlp. W przypadku YTDLP_PATH aktualizacja pozostaje zadaniem administratora hostingu.
- /youtube napraw: sprawdza, czy silnik jest dostępny, i podaje kroki diagnostyczne.
- Powtórne próby odtwarzania YouTube: najwyżej 2 próby po błędach niewskazujących na blokadę dostępu; bez zapętlania kolejki i bez ponawiania oczywistych przypadków niedostępności.
- Dłuższy timeout połączeń i zwiększone ponowienia pobierania fragmentów w yt-dlp.
- Obsługa linków /embed/ i youtube-nocookie.com/embed/.
- Opcjonalne YTDLP_FORCE_IPV4=1 dla hostingów z problematycznym IPv6.

## Instalacja
1. Zrób kopię zapasową data/, music/ i prywatnego .env (nie przesyłaj tokenów na GitHub).
2. Zaktualizuj pliki projektu z main, NIE nadpisując data/, music/ i .env.
3. Wykonaj npm install oraz npm run check.
4. Wykonaj npm run register, aby udostępnić nowe komendy Discord.
5. Zrestartuj bota.
6. Na Discord uruchom /youtube status, /youtube aktualizuj oraz /youtube diagnoza url:<link>.
7. Przetestuj kilka publicznych materiałów (krótki film, zwykły film, playlista), /radio szukaj, /testaudio i /247 status.

## Ograniczenia
YouTube może blokować konkretne IP, wymagać uwierzytelnienia, usuwać filmy lub stosować DRM. Ta aktualizacja nie obchodzi tych zabezpieczeń i nie gwarantuje dostępności wszystkich utworów. Nie przesyłaj ciasteczek sesji ani prywatnych danych logowania. Przestrzegaj warunków serwisu oraz praw do odtwarzanych materiałów.

Jeśli /youtube aktualizuj nie powiedzie się z powodu uprawnień katalogu lub blokady hostingu, sprawdź /youtube status i skontaktuj się z administratorem hostingu. Przy YTDLP_PATH aktualizacja musi nastąpić poza botem.
