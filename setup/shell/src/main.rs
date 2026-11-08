//! shrimp-setup: pełnoekranowe okno Setup Shrimp (GTK4 + WebKitGTK).
//!
//! `shrimp-setup --install`     na nośniku: interfejs serwuje agama-web-server (--web-ui-dir),
//!                              okno loguje się tokenem Agamy i otwiera kroki 1–9.
//! `shrimp-setup --first-boot`  po restarcie, w sesji nowego użytkownika: lokalny serwer
//!                              (server.rs) serwuje ten sam interfejs i API kroków 10–15.
//!                              Kończy od razu, jeśli pierwsza konfiguracja już się odbyła.
//! `shrimp-setup --restore --user NAZWA [--root /mnt] [--from KATALOG]`
//!                              po instalacji (post-install.sh): pliki z Shrimp Install do nowego konta.
mod server;
mod system;
mod transfer;

use gtk::prelude::*;
use gtk::{gio, glib};
use std::path::PathBuf;
use webkit6::prelude::*;

/// Gdzie leży zbudowany frontend (setup/web/dist).
const UI_DIR: &str = "/usr/share/shrimp-setup/ui";
/// Kopia tokenu Agamy czytelna dla użytkownika nośnika (shrimp-setup-token.service).
const TOKEN_FILES: [&str; 2] = ["/run/shrimp-setup/token", "/run/agama/token"];
const AGAMA_URL: &str = "http://127.0.0.1";
/// Jak długo `--install` czeka na token Agamy (start usług po zalogowaniu sesji live).
const TOKEN_WAIT_SECS: u32 = 180;

enum Mode {
    Install,
    FirstBoot,
}

fn arg<'a>(args: &'a [String], name: &str) -> Option<&'a String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1))
}

fn main() -> glib::ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--restore") {
        let Some(user) = arg(&args, "--user") else {
            eprintln!("użycie: shrimp-setup --restore --user NAZWA [--root /mnt] [--from KATALOG]");
            return glib::ExitCode::FAILURE;
        };
        let root = PathBuf::from(arg(&args, "--root").map(String::as_str).unwrap_or("/mnt"));
        return match transfer::restore(arg(&args, "--from").map(PathBuf::from), &root, user) {
            Ok(st) => {
                println!("shrimp-setup: przywrócono {} plików ({} B)", st.files, st.bytes);
                for f in &st.failed {
                    eprintln!("shrimp-setup: nie przywrócono {f}");
                }
                glib::ExitCode::SUCCESS
            }
            Err(e) => {
                eprintln!("shrimp-setup: {e}");
                glib::ExitCode::FAILURE
            }
        };
    }
    let mode = if args.iter().any(|a| a == "--install") {
        Mode::Install
    } else if args.iter().any(|a| a == "--first-boot" || a == "--serve") {
        Mode::FirstBoot
    } else {
        eprintln!("użycie: shrimp-setup --install | --first-boot | --serve [--ui-dir KATALOG] [--window]");
        return glib::ExitCode::FAILURE;
    };
    let ui_dir = arg(&args, "--ui-dir")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(UI_DIR));
    let windowed = args.iter().any(|a| a == "--window");

    // Do testów: sam serwer pierwszej konfiguracji, bez okna i bez sprawdzania znacznika.
    if args.iter().any(|a| a == "--serve") {
        let (port, key) = server::spawn(ui_dir).expect("serwer");
        println!("http://127.0.0.1:{port}/?mode=firstboot&k={key}");
        loop { std::thread::park(); }
    }

    let url = match mode {
        Mode::Install => {
            // Sesja live startuje szybciej niż Agama: czekamy na token zamiast od razu kończyć
            // (wcześniej okno po prostu się nie pokazywało).
            let read_token = || {
                TOKEN_FILES
                    .iter()
                    .find_map(|f| std::fs::read_to_string(f).ok())
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
            };
            let mut token = read_token();
            for _ in 0..TOKEN_WAIT_SECS * 2 {
                if token.is_some() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
                token = read_token();
            }
            match token {
                Some(t) => format!("{AGAMA_URL}/login?token={t}"),
                None => {
                    eprintln!("shrimp-setup: brak tokenu Agamy");
                    return glib::ExitCode::FAILURE;
                }
            }
        }
        Mode::FirstBoot => {
            if !system::first_boot_pending() {
                return glib::ExitCode::SUCCESS;
            }
            match server::spawn(ui_dir) {
                Ok((port, key)) => format!("http://127.0.0.1:{port}/?mode=firstboot&k={key}"),
                Err(e) => {
                    eprintln!("shrimp-setup: serwer: {e}");
                    return glib::ExitCode::FAILURE;
                }
            }
        }
    };
    let install = matches!(mode, Mode::Install);
    // Podpowiedzi z Shrimp Install dla kroków 1–9 (imię, język, strefa, klawiatura, BitLocker).
    let hint = if install { transfer::find_dir().and_then(|d| transfer::load(&d)).map(|v| transfer::hint_script(&v)) } else { None };

    let app = gtk::Application::builder()
        .application_id("org.shrimp.Setup")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(move |app| build(app, &url, install, windowed, hint.as_deref()));
    // GTK nie zna naszych argumentów.
    app.run_with_args::<&str>(&[])
}

fn build(app: &gtk::Application, url: &str, install: bool, windowed: bool, hint: Option<&str>) {
    let view = webkit6::WebView::new();
    if let (Some(js), Some(ucm)) = (hint, view.user_content_manager()) {
        ucm.add_script(&webkit6::UserScript::new(
            js,
            webkit6::UserContentInjectedFrames::TopFrame,
            webkit6::UserScriptInjectionTime::Start,
            &[],
            &[],
        ));
    }
    if let Some(s) = WebViewExt::settings(&view) {
        s.set_enable_developer_extras(std::env::var_os("SHRIMP_SETUP_DEBUG").is_some());
        s.set_hardware_acceleration_policy(webkit6::HardwareAccelerationPolicy::Never);
    }
    // Bez menu kontekstowego i bez nawigacji poza Setup.
    view.connect_context_menu(|_, _, _| true);
    // Serwer (Agama albo lokalny) może jeszcze nie słuchać: zamiast strony błędu
    // ponawiamy ładowanie co 2 s.
    view.connect_load_failed(|v, _ev, uri, err| {
        // Przerwane ładowanie (nowa nawigacja, przekierowanie) to nie błąd serwera.
        if err.matches(webkit6::NetworkError::Cancelled)
            || err.domain() == <webkit6::PolicyError as glib::error::ErrorDomain>::domain()
        {
            return false;
        }
        eprintln!("shrimp-setup: {uri}: {err}; ponawiam");
        let (v, uri) = (v.clone(), uri.to_string());
        glib::timeout_add_local_once(std::time::Duration::from_secs(2), move || v.load_uri(&uri));
        true
    });
    if install {
        // /login ustawia ciasteczko i przekierowuje na „/”; dopiero wtedy otwieramy tryb instalacji.
        view.connect_load_changed(|v, ev| {
            if ev == webkit6::LoadEvent::Finished {
                if let Some(uri) = v.uri() {
                    if uri.trim_end_matches('/') == AGAMA_URL || uri.starts_with(&format!("{AGAMA_URL}/?lang=")) {
                        v.load_uri(&format!("{AGAMA_URL}/?mode=install"));
                    }
                }
            }
        });
    }

    let win = gtk::ApplicationWindow::builder()
        .application(app)
        .title("Shrimp")
        .default_width(1366)
        .default_height(768)
        .child(&view)
        .build();
    win.set_decorated(windowed);
    if !windowed {
        win.fullscreen();
        // Setup prowadzi do końca: zamknąć można tylko przyciskiem w ostatnim kroku.
        win.connect_close_request(|_| glib::Propagation::Stop);
    }
    view.load_uri(url);
    win.present();

    // Serwer pierwszej konfiguracji prosi o zamknięcie okna po „Zaczynajmy”.
    let app = app.clone();
    glib::timeout_add_local(std::time::Duration::from_millis(300), move || {
        if server::QUIT.load(std::sync::atomic::Ordering::SeqCst) {
            app.quit();
            return glib::ControlFlow::Break;
        }
        glib::ControlFlow::Continue
    });
}
