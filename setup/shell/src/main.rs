//! shrimp-setup: pełnoekranowe okno Setup Shrimp (GTK4 + WebKitGTK).
//!
//! `shrimp-setup --install`     na nośniku: interfejs serwuje agama-web-server (--web-ui-dir),
//!                              okno loguje się tokenem Agamy i otwiera kroki 1–9.
//! `shrimp-setup --first-boot`  po restarcie, w sesji nowego użytkownika: lokalny serwer
//!                              (server.rs) serwuje ten sam interfejs i API kroków 10–15.
//!                              Kończy od razu, jeśli pierwsza konfiguracja już się odbyła.
mod server;
mod system;

use gtk::prelude::*;
use gtk::{gio, glib};
use std::path::PathBuf;
use webkit6::prelude::*;

/// Gdzie leży zbudowany frontend (setup/web/dist).
const UI_DIR: &str = "/usr/share/shrimp-setup/ui";
/// Kopia tokenu Agamy czytelna dla użytkownika nośnika (shrimp-setup-token.service).
const TOKEN_FILES: [&str; 2] = ["/run/shrimp-setup/token", "/run/agama/token"];
const AGAMA_URL: &str = "http://127.0.0.1";

enum Mode {
    Install,
    FirstBoot,
}

fn main() -> glib::ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let mode = if args.iter().any(|a| a == "--install") {
        Mode::Install
    } else if args.iter().any(|a| a == "--first-boot" || a == "--serve") {
        Mode::FirstBoot
    } else {
        eprintln!("użycie: shrimp-setup --install | --first-boot | --serve [--ui-dir KATALOG] [--window]");
        return glib::ExitCode::FAILURE;
    };
    let ui_dir = args
        .iter()
        .position(|a| a == "--ui-dir")
        .and_then(|i| args.get(i + 1))
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
            let token = TOKEN_FILES
                .iter()
                .find_map(|f| std::fs::read_to_string(f).ok())
                .map(|t| t.trim().to_string());
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

    let app = gtk::Application::builder()
        .application_id("org.shrimp.Setup")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(move |app| build(app, &url, install, windowed));
    // GTK nie zna naszych argumentów.
    app.run_with_args::<&str>(&[])
}

fn build(app: &gtk::Application, url: &str, install: bool, windowed: bool) {
    let view = webkit6::WebView::new();
    if let Some(s) = WebViewExt::settings(&view) {
        s.set_enable_developer_extras(std::env::var_os("SHRIMP_SETUP_DEBUG").is_some());
        s.set_hardware_acceleration_policy(webkit6::HardwareAccelerationPolicy::Never);
    }
    // Bez menu kontekstowego i bez nawigacji poza Setup.
    view.connect_context_menu(|_, _, _| true);
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
