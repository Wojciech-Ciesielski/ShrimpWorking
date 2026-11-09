# Przenosiny do repozytorium otwartego

To repozytorium jest brudnopisem. Oficjalne repozytorium wydania jest osobne. Kod jest przygotowany tak, żeby przenosiny nie wymagały zmian w programie:

- **Adresy zależą od repozytorium.** Shrimp Install bierze adres manifestu z `shrimp_config.h`, który `shrimp-install/tools/prepare.sh` tworzy z `github.repository` i widoczności repozytorium. W repozytorium publicznym program pobiera ISO bez tokenu z `https://github.com/<repo>/releases/latest/download/manifest.json`. Workflow **Release** też nie ma zapisanej nazwy repozytorium.
- **Czyste drzewo:** `tools/export-open.sh KATALOG` kopiuje stan gałęzi (wyniki testów CI są na osobnej gałęzi `wyniki-testow`), szuka sekretów i śladów prywatnego repo, sprawdza licencje i duże pliki. Historia git nie jest przenoszona.

## Do zrobienia przed publikacją (decyzje właściciela)

1. **Licencja Shrimp.** W korzeniu nie ma pliku `LICENSE`. Fork Rufusa (`shrimp-install/rufus`) jest na GPLv3, więc ta część zostaje GPLv3; resztę trzeba wybrać (np. GPLv3 dla spójności).
2. **Dane osobowe:** `kiwi/config.kiwi` zawiera prywatny adres e-mail w `<contact>`; zamień na adres projektu.
3. **Nazwa i znaki towarowe:** ISO jest oparte na openSUSE Leap (`ID_LIKE=opensuse-leap`, adresy openSUSE w `os-release`). Sprawdź zasady używania znaków towarowych i dystrybucji pakietów (m.in. sterownik NVIDIA, rozszerzenia GNOME pobierane z extensions.gnome.org).
4. **Czcionki i grafiki:** Inter i Noto (SIL OFL) są używane tylko do renderowania ikon GRUB; zrzuty i grafiki z `shrimp-handoff.zip` są Twoje, ale dodaj ich licencję.
5. **Podpisy:** klucz podpisu manifestu (sekret `SHRIMP_MANIFEST_KEY`, klucz publiczny do programu przez `shrimp-install/tools/make-key.sh`) i podpis Authenticode `.exe` (SmartScreen).
6. **Sekrety CI:** w nowym repozytorium nie ma żadnych; Release używa tylko `GITHUB_TOKEN`.
