# Weryfikacja katalogu aplikacji internetowych

Sprawdzono: 2026-11-08 12:15 UTC (GitHub Actions, `apps/web-apps/tools/verify.py`).

Główna lista: 150 pozycji. Odpowiada poprawnie (2xx): 133, serwer odrzuca automat (401/403/429/503): 11, błąd (404, 5xx, DNS, TLS, limit czasu): 6. Ikony pobrane: 139.

„zablokowane” znaczy, że serwer istnieje i odpowiada, ale nie wpuszcza skryptu (np. ochrona przed botami); adresu nie dało się więc potwierdzić w pełni.

## Główna lista

| Nazwa | Adres | Wynik | HTTP | Przekierowanie | Manifest PWA | Ikona |
|---|---|---|---|---|---|---|
| WhatsApp | https://web.whatsapp.com/ | błąd | 400 |  | nie | favicon 64px |
| Telegram | https://web.telegram.org/ | ok | 200 |  | tak | manifest 192px |
| Messenger | https://www.messenger.com/ | ok | 200 |  | nie | brak (litera) |
| Facebook | https://www.facebook.com/ | błąd | 400 |  | nie | favicon 60px |
| Instagram | https://www.instagram.com/ | ok | 200 |  | nie | apple 180px |
| X | https://x.com/ | ok | 200 |  | tak | manifest 192px |
| Threads | https://www.threads.com/ | ok | 200 |  | nie | icon 64px |
| Bluesky | https://bsky.app/ | ok | 200 |  | nie | apple 180px |
| Mastodon | https://mastodon.social/ | ok | 200 |  | tak | manifest 192px |
| Reddit | https://www.reddit.com/ | zablokowane | 403 |  | nie | favicon 32px |
| LinkedIn | https://www.linkedin.com/ | ok | 200 |  | nie | icon 64px |
| Pinterest | https://www.pinterest.com/ | ok | 200 |  | tak | manifest 192px |
| Discord | https://discord.com/app | ok | 200 |  | nie | icon 256px |
| Slack | https://app.slack.com/client | ok | 200 |  | nie | favicon 256px |
| Microsoft Teams | https://teams.microsoft.com/ | ok | 200 | https://teams.microsoft.com/v2/ | tak | manifest 192px |
| Zoom | https://app.zoom.us/wc | ok | 200 |  | tak | icon 96px |
| Google Meet | https://meet.google.com/ | ok | 200 | https://workspace.google.com/products/meet/ | nie | icon 20px |
| Snapchat | https://www.snapchat.com/web | ok | 200 |  | tak | manifest 192px |
| TikTok | https://www.tiktok.com/ | ok | 200 |  | tak | manifest 192px |
| Gmail | https://mail.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://mail.google.com/mail/u/0/&emr=1&followup=https://mail.google.com/mail/u/0/&osid=1&passive=1209600&service=mail&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-1004491357:1794140074414748 | nie | favicon 32px |
| Outlook | https://outlook.live.com/mail/ | ok | 200 |  | nie | apple 180px |
| Proton Mail | https://mail.proton.me/ | ok | 200 |  | tak | manifest 192px |
| Tuta | https://app.tuta.com/ | ok | 200 |  | nie | apple 512px |
| Wikipedia | https://pl.wikipedia.org/ | ok | 200 | https://pl.wikipedia.org/wiki/Wikipedia:Strona_g%C5%82%C3%B3wna | nie | apple 160px |
| ChatGPT | https://chatgpt.com/ | ok | 200 |  | tak | manifest 192px |
| Claude | https://claude.ai/ | zablokowane | 403 |  | nie | favicon 48px |
| Gemini | https://gemini.google.com/ | ok | 200 |  | tak | manifest 512px |
| Microsoft Copilot | https://copilot.microsoft.com/ | ok | 200 | https://copilot.com/ | nie | icon 48px |
| Perplexity | https://www.perplexity.ai/ | ok | 200 |  | nie | apple 180px |
| Allegro | https://allegro.pl/ | błąd | TimeoutError: The read operation timed out |  | nie | favicon 48px |
| OLX | https://www.olx.pl/ | ok | 200 |  | nie | apple 192px |
| Amazon | https://www.amazon.pl/ | ok | 200 |  | nie | favicon 48px |
| AliExpress | https://www.aliexpress.com/ | błąd | 302 | https://login.aliexpress.us/sync_cookie_write.htm?acs_random_token=7269a8e5bf2f4f48b29a8bc41e46918e&xman_goto=https%3A%2F%2Fwww.aliexpress.us%2F%3FgatewayAdapt%3Dglo2usa%26_randl_shipto%3DUS&_ga=GA1.1.1784879172230147.1794140076592 | nie | brak (litera) |
| PayPal | https://www.paypal.com/ | ok | 200 | https://www.paypal.com/us/home | nie | apple 144px |
| Google Docs | https://docs.google.com/document/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://docs.google.com/document/&followup=https://docs.google.com/document/&ltmpl=docs&osid=1&passive=1209600&service=wise&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-1004491357:1794140074734615 | nie | favicon 32px |
| Google Sheets | https://docs.google.com/spreadsheets/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://docs.google.com/spreadsheets/&followup=https://docs.google.com/spreadsheets/&ltmpl=sheets&osid=1&passive=1209600&service=wise&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140074747580 | nie | favicon 32px |
| Google Slides | https://docs.google.com/presentation/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://docs.google.com/presentation/&followup=https://docs.google.com/presentation/&ltmpl=slides&osid=1&passive=1209600&service=wise&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-14255718:1794140074828389 | nie | favicon 32px |
| Google Forms | https://docs.google.com/forms/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://docs.google.com/forms/&followup=https://docs.google.com/forms/&ltmpl=forms&osid=1&passive=1209600&service=wise&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140074863751 | nie | favicon 32px |
| Google Drive | https://drive.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://drive.google.com/&emr=1&followup=https://drive.google.com/&osid=1&passive=1209600&service=wise&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140074921824 | nie | favicon 32px |
| Google Calendar | https://calendar.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://calendar.google.com/calendar/u/0/r&emr=1&followup=https://calendar.google.com/calendar/u/0/r&osid=1&passive=1209600&service=cl&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140074990835 | nie | favicon 32px |
| Google Keep | https://keep.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://keep.google.com/&followup=https://keep.google.com/&ltmpl=keep&passive=1209600&service=memento&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140074931596 | nie | favicon 32px |
| Microsoft 365 | https://m365.cloud.microsoft/ | ok | 200 |  | nie | icon 48px |
| Word | https://word.cloud.microsoft/ | ok | 200 | https://word.cloud.microsoft/pl-pl/ | nie | apple 144px |
| Excel | https://excel.cloud.microsoft/ | ok | 200 | https://excel.cloud.microsoft/pl-pl/ | nie | apple 144px |
| PowerPoint | https://powerpoint.cloud.microsoft/ | ok | 200 | https://powerpoint.cloud.microsoft/pl-pl/ | nie | apple 144px |
| OneDrive | https://onedrive.live.com/ | ok | 200 | https://www.microsoft.com/en-us/microsoft-365/onedrive/online-cloud-storage | nie | icon 128px |
| OneNote | https://www.onenote.com/notebooks | ok | 200 | https://onenote.cloud.microsoft/ | nie | apple 144px |
| Dropbox | https://www.dropbox.com/home | ok | 200 | https://www.dropbox.com/login?cont=%2Fhome | nie | icon 32px |
| Proton Drive | https://drive.proton.me/ | ok | 200 |  | tak | manifest 192px |
| Notion | https://www.notion.so/ | ok | 200 | https://www.notion.com/ | nie | apple 512px |
| Todoist | https://app.todoist.com/ | ok | 200 | https://app.todoist.com/auth/login | tak | manifest 192px |
| Trello | https://trello.com/ | ok | 200 |  | nie | icon 256px |
| Asana | https://app.asana.com/ | ok | 200 | https://app.asana.com/-/login | nie | apple 72px |
| Atlassian (Jira, Confluence) | https://start.atlassian.com/ | ok | 200 |  | nie | favicon 48px |
| ClickUp | https://app.clickup.com/ | ok | 200 |  | tak | brak (litera) |
| monday.com | https://monday.com/ | ok | 200 | https://monday.com/lang/pl | nie | apple 57px |
| Linear | https://linear.app/ | ok | 200 |  | tak | manifest 192px |
| Miro | https://miro.com/app/ | ok | 200 | https://miro.com/pl/signup/ | nie | icon 48px |
| Overleaf | https://www.overleaf.com/ | ok | 200 |  | tak | manifest 261px |
| Grammarly | https://app.grammarly.com/ | ok | 200 | https://www.grammarly.com/ | nie | icon 32px |
| LanguageTool | https://languagetool.org/editor | ok | 200 | https://languagetool.org/pl/user-login | tak | manifest 192px |
| Google Classroom | https://classroom.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://classroom.google.com/&emr=1&followup=https://classroom.google.com/&passive=1209600&service=classroom&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S1612965395:1794140075744929 | nie | favicon 32px |
| Duolingo | https://www.duolingo.com/ | ok | 200 |  | tak | manifest 192px |
| YouTube | https://www.youtube.com/ | ok | 200 |  | tak | manifest 192px |
| Netflix | https://www.netflix.com/ | ok | 200 |  | nie | apple 64px |
| Disney+ | https://www.disneyplus.com/ | ok | 200 |  | tak | manifest 192px |
| Prime Video | https://www.primevideo.com/ | ok | 200 | https://www.primevideo.com/offers/nonprimehomepage?ref_=dv_web_force_root | nie | apple 76px |
| HBO Max | https://play.hbomax.com/ | ok | 200 | https://www.hbomax.com/ | nie | apple 180px |
| Apple TV | https://tv.apple.com/ | ok | 200 |  | tak | manifest 192px |
| SkyShowtime | https://www.skyshowtime.com/ | ok | 200 | https://www.skyshowtime.com/where-can-i-stream | nie | icon 180px |
| Player | https://player.pl/ | ok | 200 |  | nie | apple 180px |
| Polsat Box Go | https://polsatboxgo.pl/ | ok | 200 | https://polsatboxgo.pl/start?pk=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NHcm91cHMiOlsiYXBwOmFsbCIsImFwcDpicm93c2VyIiwiYXBwOmNocm9tZSIsImJ1aWxkOjMiLCJjcHVzZXI6ZmFsc2UiLCJkZXY6YWxsIiwiZGV2OnBjIiwiZm9yY2VwbDpmYWxzZSIsImxlZ2FjeV91c2VyOmZhbHNlIiwibG9jOmFsbCIsImxvYzp3b3JsZCIsImxvZ2dlZDpmYWxzZSIsIm9zOmFsbCIsIm9zOmxpbnV4IiwicGxheWVyOmFsbCIsInBsYXllcjpodG1sIiwicGx1c3VzZXI6ZmFsc2UiLCJwb3J0YWw6cGJnIiwicHJlc3M6ZmFsc2UiLCJ0ZXN0ZXI6ZmFsc2UiLCJ0ZXN0ZXJfcGVyOmZhbHNlIiwidmVyaWZpZWQ6ZmFsc2UiLCJ2cG46ZmFsc2UiXSwiY29uc3RhbnRzIjpbInJvZG9FeHRlcm5hbENvb2tpZXNFbmFibGVkIl19.GcCI9LEIXduSkGZw8aQ7tdKFHPEy3Y6S_O5SohwObBk | nie | favicon 48px |
| TVP VOD | https://vod.tvp.pl/ | ok | 200 |  | tak | icon 60px |
| CDA | https://www.cda.pl/ | ok | 200 |  | tak | apple 192px |
| Crunchyroll | https://www.crunchyroll.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Twitch | https://www.twitch.tv/ | ok | 200 |  | nie | icon 32px |
| Vimeo | https://vimeo.com/ | ok | 200 |  | nie | apple 180px |
| Plex | https://app.plex.tv/ | ok | 200 | https://app.plex.tv/desktop/ | nie | apple 57px |
| Clipchamp | https://app.clipchamp.com/ | ok | 200 | https://app.clipchamp.com/consumer/ | nie | icon 96px |
| CapCut | https://www.capcut.com/editor | ok | 200 |  | tak | manifest 128px |
| Spotify | https://open.spotify.com/ | ok | 200 |  | tak | manifest 128px |
| YouTube Music | https://music.youtube.com/ | ok | 200 |  | tak | manifest 32px |
| Apple Music | https://music.apple.com/ | ok | 200 | https://music.apple.com/us/new | tak | manifest 192px |
| Amazon Music | https://music.amazon.com/ | ok | 200 |  | nie | apple 256px |
| Tidal | https://listen.tidal.com/ | zablokowane | 403 | https://tidal.com/ | nie | favicon 48px |
| Deezer | https://www.deezer.com/ | ok | 200 | https://www.deezer.com/pl/ | nie | apple 180px |
| SoundCloud | https://soundcloud.com/ | ok | 200 |  | tak | manifest 192px |
| Bandcamp | https://bandcamp.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Qobuz | https://play.qobuz.com/ | ok | 200 |  | tak | apple 180px |
| Pocket Casts | https://play.pocketcasts.com/ | ok | 200 | https://pocketcasts.com/play | tak | manifest 192px |
| Audible | https://www.audible.com/ | ok | 200 |  | nie | apple 120px |
| Open FM | https://open.fm/ | ok | 200 |  | tak | manifest 192px |
| Radio Garden | https://radio.garden/ | ok | 200 |  | tak | apple 76px |
| Last.fm | https://www.last.fm/ | ok | 200 |  | nie | apple 1024px |
| Canva | https://www.canva.com/ | zablokowane | 403 |  | nie | favicon 32px |
| Figma | https://www.figma.com/ | ok | 200 |  | tak | manifest 192px |
| Photopea | https://www.photopea.com/ | ok | 200 |  | tak | manifest 512px |
| Adobe Express | https://new.express.adobe.com/ | ok | 200 | https://express.adobe.com/ | tak | manifest 192px |
| Pixlr | https://pixlr.com/ | ok | 200 | https://pixlr.com/pl/ | tak | manifest 192px |
| Penpot | https://design.penpot.app/ | ok | 200 |  | nie | icon 346px |
| Excalidraw | https://excalidraw.com/ | ok | 200 |  | tak | manifest 192px |
| tldraw | https://www.tldraw.com/ | ok | 200 |  | tak | manifest 193px |
| draw.io | https://app.diagrams.net/ | ok | 200 |  | tak | manifest 192px |
| Google Zdjęcia | https://photos.google.com/ | ok | 200 | https://www.google.com/photos/about/ | nie | icon 683px |
| remove.bg | https://www.remove.bg/ | ok | 200 | https://www.remove.bg/pl | tak | manifest 192px |
| Squoosh | https://squoosh.app/ | ok | 200 |  | tak | manifest 1024px |
| Coolors | https://coolors.co/ | zablokowane | 403 |  | nie | brak (litera) |
| Tinkercad | https://www.tinkercad.com/ | ok | 200 |  | tak | manifest 192px |
| Chess.com | https://www.chess.com/ | ok | 200 |  | tak | manifest 192px |
| Lichess | https://lichess.org/ | ok | 200 |  | tak | manifest 192px |
| GeForce NOW | https://play.geforcenow.com/ | ok | 200 | https://play.geforcenow.com/mall/ | tak | manifest 192px |
| Xbox Cloud Gaming | https://www.xbox.com/play | ok | 200 | https://play.xbox.com/ | tak | manifest 192px |
| Boosteroid | https://cloud.boosteroid.com/ | błąd | 307 |  | nie | favicon 48px |
| Steam | https://store.steampowered.com/ | ok | 200 |  | nie | icon 256px |
| itch.io | https://itch.io/ | ok | 200 |  | tak | manifest 144px |
| Poki | https://poki.com/ | ok | 200 | https://poki.com/pl#utm_source=redirect-en-pl | tak | manifest 192px |
| CrazyGames | https://www.crazygames.com/ | ok | 200 |  | tak | manifest 192px |
| GeoGuessr | https://www.geoguessr.com/ | ok | 200 |  | tak | manifest 192px |
| Board Game Arena | https://boardgamearena.com/ | ok | 200 | https://pl.boardgamearena.com/ | tak | manifest 192px |
| Wordle | https://www.nytimes.com/games/wordle/index.html | ok | 200 |  | tak | apple 192px |
| GitHub | https://github.com/ | błąd | TimeoutError: The read operation timed out |  | nie | brak (litera) |
| GitLab | https://gitlab.com/ | ok | 200 | https://about.gitlab.com/ | nie | apple 192px |
| Codeberg | https://codeberg.org/ | ok | 200 |  | tak | manifest 256px |
| Visual Studio Code | https://vscode.dev/ | ok | 200 |  | nie | brak (litera) |
| CodePen | https://codepen.io/ | zablokowane | 403 |  | nie | brak (litera) |
| CodeSandbox | https://codesandbox.io/ | ok | 200 |  | nie | brak (litera) |
| StackBlitz | https://stackblitz.com/ | ok | 200 |  | nie | icon 16px |
| Google Colab | https://colab.research.google.com/ | ok | 200 |  | nie | icon 128px |
| Stack Overflow | https://stackoverflow.com/ | zablokowane | 403 |  | nie | brak (litera) |
| MDN Web Docs | https://developer.mozilla.org/ | ok | 200 | https://developer.mozilla.org/en-US/ | tak | manifest 192px |
| regex101 | https://regex101.com/ | ok | 200 |  | tak | manifest 192px |
| Compiler Explorer | https://godbolt.org/ | ok | 200 |  | nie | icon 128px |
| Postman | https://web.postman.co/ | zablokowane | 403 | https://identity.getpostman.com/login?continue=https%3A%2F%2Fweb.postman.co%2F&utm_referrer=https%3A%2F%2Fweb.postman.co%2F | nie | favicon 32px |
| Vercel | https://vercel.com/dashboard | ok | 200 | https://vercel.com/login?next=%2Fdashboard | tak | manifest 192px |
| Cloudflare | https://dash.cloudflare.com/ | zablokowane | 403 |  | nie | favicon 99px |
| Hugging Face | https://huggingface.co/ | ok | 200 |  | nie | favicon 256px |
| Google Maps | https://www.google.com/maps | ok | 200 |  | tak | manifest 192px |
| Google Translate | https://translate.google.com/ | ok | 200 |  | tak | manifest 64px |
| DeepL | https://www.deepl.com/translator | ok | 200 | https://www.deepl.com/pl/translator | nie | apple 180px |
| OpenStreetMap | https://www.openstreetmap.org/ | ok | 200 |  | tak | manifest 192px |
| Windy | https://www.windy.com/ | ok | 200 |  | tak | manifest 192px |
| Speedtest | https://www.speedtest.net/ | ok | 200 |  | tak | manifest 192px |
| Desmos | https://www.desmos.com/calculator | ok | 200 | https://www.desmos.com/calculator?lang=pl | tak | manifest 192px |
| GeoGebra | https://www.geogebra.org/calculator | ok | 200 |  | tak | manifest 192px |
| WeTransfer | https://wetransfer.com/ | ok | 200 |  | nie | apple 57px |
| Smallpdf | https://smallpdf.com/ | ok | 200 |  | nie | apple 180px |
| iLovePDF | https://www.ilovepdf.com/ | ok | 200 |  | nie | apple 114px |
| Bitwarden | https://vault.bitwarden.com/ | ok | 200 |  | tak | manifest 192px |
| Proton Pass | https://pass.proton.me/ | ok | 200 |  | tak | manifest 192px |
| Jakdojade | https://jakdojade.pl/ | ok | 200 |  | tak | manifest 192px |

## Rezerwa (do podmiany błędnych pozycji)

| Nazwa | Adres | Wynik | HTTP | Przekierowanie | Manifest PWA | Ikona |
|---|---|---|---|---|---|---|
| Google Chat | https://chat.google.com/ | ok | 200 | https://accounts.google.com/v3/signin/identifier?continue=https://chat.google.com/&emr=1&osid=1&passive=1209600&service=dynamite&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-417591354:1794140080110358 | nie | favicon 32px |
| Element | https://app.element.io/ | ok | 200 |  | tak | manifest 180px |
| Tumblr | https://www.tumblr.com/ | ok | 200 |  | tak | manifest 192px |
| Yahoo Mail | https://mail.yahoo.com/ | ok | 200 |  | nie | icon 32px |
| Fastmail | https://app.fastmail.com/ | ok | 200 |  | tak | manifest 512px |
| Medium | https://medium.com/ | zablokowane | 403 |  | nie | favicon 32px |
| Substack | https://substack.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Feedly | https://feedly.com/ | ok | 200 |  | nie | apple 144px |
| Inoreader | https://www.inoreader.com/ | ok | 200 |  | tak | manifest 192px |
| Google News | https://news.google.com/ | ok | 200 | https://news.google.com/home?hl=pl&gl=PL&ceid=PL:pl | tak | manifest 192px |
| Le Chat | https://chat.mistral.ai/ | zablokowane | 403 |  | nie | brak (litera) |
| Grok | https://grok.com/ | ok | 200 |  | tak | manifest 512px |
| DeepSeek | https://chat.deepseek.com/ | ok | 202 |  | nie | brak (litera) |
| Revolut | https://app.revolut.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Wise | https://wise.com/ | ok | 200 |  | nie | apple 180px |
| Microsoft To Do | https://to-do.office.com/ | ok | 200 | https://to-do.office.com/tasks/ | nie | brak (litera) |
| Box | https://app.box.com/ | ok | 200 | https://account.box.com/login | tak | apple 180px |
| MEGA | https://mega.nz/ | ok | 200 |  | nie | icon 32px |
| Proton Calendar | https://calendar.proton.me/ | ok | 200 |  | tak | manifest 192px |
| iCloud | https://www.icloud.com/ | ok | 200 |  | nie | icon 48px |
| Evernote | https://www.evernote.com/client/web | ok | 200 | https://accounts.evernote.com/login | nie | apple 180px |
| TickTick | https://ticktick.com/webapp | ok | 200 | https://ticktick.com/ | nie | apple 180px |
| Airtable | https://airtable.com/ | ok | 200 | https://www.airtable.com/ | nie | icon 48px |
| Coda | https://coda.io/ | ok | 200 |  | tak | manifest 192px |
| Calendly | https://calendly.com/app | błąd | 404 |  | nie | favicon 48px |
| Khan Academy | https://www.khanacademy.org/ | ok | 200 |  | nie | favicon 32px |
| Quizlet | https://quizlet.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Coursera | https://www.coursera.org/ | ok | 200 |  | nie | apple 180px |
| Udemy | https://www.udemy.com/ | zablokowane | 403 |  | nie | brak (litera) |
| Kahoot! | https://create.kahoot.it/ | ok | 200 |  | tak | apple 32px |
| Kick | https://kick.com/ | ok | 200 |  | nie | apple 180px |
| Dailymotion | https://www.dailymotion.com/ | ok | 200 |  | tak | apple 192px |
| Pluto TV | https://pluto.tv/ | ok | 200 |  | tak | manifest 256px |
| Loom | https://www.loom.com/ | ok | 200 |  | nie | apple 180px |
| Storytel | https://www.storytel.com/ | ok | 200 | https://www.storytel.com/store-select | tak | manifest 192px |
| Mixcloud | https://www.mixcloud.com/ | ok | 200 |  | nie | apple 152px |
| Genius | https://genius.com/ | zablokowane | 403 |  | nie | brak (litera) |
| BandLab | https://www.bandlab.com/ | ok | 200 |  | tak | manifest 192px |
| Unsplash | https://unsplash.com/ | zablokowane | 401 | https://unsplash.com/.within.website?redir=%2F | nie | favicon 32px |
| Behance | https://www.behance.net/ | zablokowane | 403 |  | nie | brak (litera) |
| Replit | https://replit.com/ | ok | 200 |  | tak | manifest 192px |
| DevDocs | https://devdocs.io/ | ok | 200 |  | tak | manifest 192px |
| Hoppscotch | https://hoppscotch.io/ | ok | 200 |  | tak | manifest 192px |
| Supabase | https://supabase.com/dashboard | ok | 200 | https://supabase.com/dashboard/org | tak | manifest 192px |
| WolframAlpha | https://www.wolframalpha.com/ | ok | 200 |  | nie | icon 64px |
| Toggl Track | https://track.toggl.com/ | ok | 200 |  | nie | favicon 96px |
| PairDrop | https://pairdrop.net/ | ok | 200 |  | tak | manifest 192px |
| Internet Archive | https://archive.org/ | ok | 200 |  | nie | apple 180px |
| Google Earth | https://earth.google.com/web/ | ok | 200 |  | nie | icon 48px |
