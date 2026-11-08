//! Panko: cofanie zmian w systemie Shrimp. Nakładka GTK4 + libadwaita na migawki
//! (usługa `org.opensuse.Snapper`). `panko --demo` pokazuje przykładowe dane z makiety.

mod backend;
mod demo;
mod escape;
mod help;
mod model;
mod ui;

use std::sync::Arc;

use adw::prelude::*;

const APP_ID: &str = "org.shrimp.Panko";

fn main() -> gtk::glib::ExitCode {
    let demo = std::env::args().any(|a| a == "--demo")
        || std::env::var("PANKO_DEMO").is_ok_and(|v| v == "1");
    let app = adw::Application::builder()
        .application_id(APP_ID)
        .flags(gtk::gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(move |app| {
        let backend: Arc<dyn backend::Backend> = if demo {
            Arc::new(demo::Demo::new())
        } else {
            match backend::Dbus::connect() {
                Ok(b) => Arc::new(b),
                Err(e) => {
                    // Bez magistrali systemowej okno pokaże stan „niedostępne”.
                    eprintln!("panko: {e}");
                    Arc::new(backend::Offline)
                }
            }
        };
        ui::build(app, backend);
    });
    // Własne argumenty (--demo) nie trafiają do GApplication.
    app.run_with_args(&[std::env::args().next().unwrap_or_default()])
}
