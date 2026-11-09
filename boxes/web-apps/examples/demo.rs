//! Podgląd strony bez Shrimp Apps: `cargo run --example demo`.
//! Z argumentem `--screenshot plik.png` zapisuje zrzut okna i kończy (CI).
use adw::prelude::*;

fn main() -> gtk::glib::ExitCode {
    let arg = |name: &str| std::env::args().skip_while(|a| a != name).nth(1);
    let shot = arg("--screenshot");
    // --click <id>: naciska przycisk „Utwórz” w wierszu tej aplikacji (test w CI).
    let click = arg("--click");
    let app = adw::Application::builder().application_id("org.shrimp.WebAppsDemo").build();
    app.connect_activate(move |app| {
        let view = adw::ToolbarView::new();
        let header = adw::HeaderBar::new();
        header.set_title_widget(Some(&adw::WindowTitle::new(&shrimp_webapps::i18n::tr("page.title"), "")));
        view.add_top_bar(&header);
        view.set_content(Some(&shrimp_webapps::page()));
        let win = adw::ApplicationWindow::builder().application(app).default_width(960).default_height(720).content(&view).build();
        win.present();
        if let Some(id) = click.clone() {
            let root: gtk::Widget = win.clone().upcast();
            gtk::glib::timeout_add_local_once(std::time::Duration::from_millis(500), move || {
                let row = find(&root, &|w| w.widget_name().contains(&format!("|{id}|"))).expect("brak wiersza");
                let line = row.first_child().unwrap();
                let button = line.last_child().unwrap().downcast::<gtk::Button>().unwrap();
                println!("przycisk przed: {}", button.label().unwrap_or_default());
                button.emit_clicked();
                println!("przycisk po: {}", button.label().unwrap_or_default());
            });
        }
        if let Some(path) = shot.clone() {
            let win = win.clone();
            gtk::glib::timeout_add_local_once(std::time::Duration::from_millis(1500), move || {
                let paintable = gtk::WidgetPaintable::new(Some(&win));
                let (w, h) = (win.width(), win.height());
                let snap = gtk::Snapshot::new();
                paintable.snapshot(&snap, w as f64, h as f64);
                if let Some(node) = snap.to_node() {
                    if let Some(renderer) = win.native().and_then(|n| n.renderer()) {
                        let tex = renderer.render_texture(&node, Some(&gtk::graphene::Rect::new(0.0, 0.0, w as f32, h as f32)));
                        tex.save_to_png(&path).expect("zapis zrzutu");
                    }
                }
                win.application().unwrap().quit();
            });
        }
    });
    app.run_with_args::<&str>(&[])
}

fn find(w: &gtk::Widget, pred: &dyn Fn(&gtk::Widget) -> bool) -> Option<gtk::Widget> {
    if pred(w) {
        return Some(w.clone());
    }
    let mut c = w.first_child();
    while let Some(child) = c {
        if let Some(f) = find(&child, pred) {
            return Some(f);
        }
        c = child.next_sibling();
    }
    None
}
