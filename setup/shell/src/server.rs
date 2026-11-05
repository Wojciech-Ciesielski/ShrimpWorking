//! Lokalny serwer pierwszej konfiguracji: serwuje frontend (setup/web/dist) i /shrimp/api/*
//! tylko na 127.0.0.1, z losowym kluczem sesji w nagłówku X-Shrimp-Key.
use crate::system;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    path::PathBuf,
    sync::{atomic::AtomicBool, Arc},
    time::Instant,
};
use tokio::sync::Mutex;
use tower_http::services::ServeDir;

/// Ustawiane po „Zaczynajmy”, gdy okno ma się zamknąć (main.rs sprawdza je co 300 ms).
pub static QUIT: AtomicBool = AtomicBool::new(false);

#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Job {
    state: &'static str,
    percent: f64,
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    eta_min: Option<u64>,
}

#[derive(Default)]
struct Inner {
    codecs: bool,
    nvidia: String,
    apps: Job,
}

#[derive(Clone)]
struct App {
    key: Arc<String>,
    inner: Arc<Mutex<Inner>>,
}

/// Uruchamia serwer w osobnym wątku. Zwraca port i klucz sesji.
pub fn spawn(ui_dir: PathBuf) -> std::io::Result<(u16, String)> {
    let key: String = {
        use rand::Rng;
        let mut r = rand::rng();
        (0..32).map(|_| format!("{:x}", r.random_range(0..16u8))).collect()
    };
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    std_listener.set_nonblocking(true)?;
    let port = std_listener.local_addr()?.port();
    let state = App {
        key: Arc::new(key.clone()),
        inner: Arc::new(Mutex::new(Inner { codecs: false, nvidia: "none".into(), apps: Job { state: "idle", ..Default::default() } })),
    };
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("tokio");
        rt.block_on(async move {
            let listener = tokio::net::TcpListener::from_std(std_listener).expect("listener");
            axum::serve(listener, router(state, ui_dir)).await.expect("serve");
        });
    });
    Ok((port, key))
}

fn router(state: App, ui_dir: PathBuf) -> Router {
    let api = Router::new()
        .route("/info", get(info))
        .route("/networks", get(networks))
        .route("/network/connect", post(connect))
        .route("/network/advanced", post(advanced))
        .route("/appearance", post(appearance))
        .route("/drivers", post(drivers))
        .route("/apps", post(apps_start).get(apps_status))
        .route("/finish", post(finish))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state);
    Router::new().nest("/shrimp/api", api).fallback_service(ServeDir::new(ui_dir))
}

async fn auth(State(s): State<App>, req: Request, next: Next) -> Response {
    let ok = req.headers().get("x-shrimp-key").and_then(|v| v.to_str().ok()) == Some(s.key.as_str());
    if ok { next.run(req).await } else { StatusCode::FORBIDDEN.into_response() }
}

fn err(kind: &str, msg: impl ToString) -> Response {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": kind, "message": msg.to_string() }))).into_response()
}

async fn info() -> Json<system::Info> { Json(system::info().await) }
async fn networks() -> Json<Vec<system::Network>> { Json(system::networks().await) }

async fn connect(Json(c): Json<system::Connect>) -> Response {
    match system::connect(&c).await {
        Ok(()) => Json(json!({})).into_response(),
        Err(e) => err("wifi", e.0),
    }
}

async fn advanced(Json(a): Json<system::Advanced>) -> Response {
    match system::advanced(&a).await {
        Ok(()) => Json(json!({})).into_response(),
        Err(e) => err("system", e.0),
    }
}

#[derive(Deserialize)]
struct Appearance { scheme: String, accent: Option<String> }
async fn appearance(Json(a): Json<Appearance>) -> Response {
    match system::appearance(&a.scheme, a.accent.as_deref()).await {
        Ok(()) => Json(json!({})).into_response(),
        Err(e) => err("system", e.0),
    }
}

#[derive(Deserialize)]
struct Drivers { install: bool, nvidia: Option<String> }
/// Wybór jest tylko zapamiętywany; instalacja idzie w jednej migawce przy „Zaczynajmy”.
async fn drivers(State(s): State<App>, Json(d): Json<Drivers>) -> Json<serde_json::Value> {
    let mut i = s.inner.lock().await;
    i.codecs = d.install;
    i.nvidia = match (d.install, d.nvidia.as_deref()) {
        (true, Some("nvidia")) => "nvidia",
        (true, Some("open")) => "open",
        _ => "none",
    }
    .into();
    Json(json!({}))
}

#[derive(Deserialize)]
struct Apps { ids: Vec<String> }

async fn apps_start(State(s): State<App>, Json(a): Json<Apps>) -> Response {
    {
        let mut i = s.inner.lock().await;
        if i.apps.state == "running" {
            return Json(json!({})).into_response();
        }
        i.apps = Job { state: "running", percent: 0.0, phase: "Pobieranie i instalowanie".into(), eta_min: None };
    }
    let inner = s.inner.clone();
    tokio::spawn(async move {
        if !system::online().await {
            inner.lock().await.apps.state = "offline";
            return;
        }
        let total = a.ids.len().max(1);
        let t0 = Instant::now();
        let mut failed = 0;
        for (n, id) in a.ids.iter().enumerate() {
            if let Err(e) = system::install_app(id).await {
                eprintln!("shrimp-setup: {id}: {}", e.0);
                if !system::online().await {
                    inner.lock().await.apps.state = "offline";
                    return;
                }
                // Jeden program, którego nie ma we Flathub (albo nie da się go zainstalować), nie zatrzymuje reszty.
                failed += 1;
            }
            let done = n + 1;
            let per = t0.elapsed().as_secs_f64() / done as f64;
            let mut i = inner.lock().await;
            i.apps.percent = done as f64 / total as f64 * 100.0;
            i.apps.eta_min = Some(((per * (total - done) as f64) / 60.0).ceil() as u64);
        }
        let mut i = inner.lock().await;
        i.apps.state = if failed > 0 && failed == a.ids.len() { "failed" } else { "done" };
        i.apps.percent = 100.0;
    });
    Json(json!({})).into_response()
}

async fn apps_status(State(s): State<App>) -> Json<Job> { Json(s.inner.lock().await.apps.clone()) }

async fn finish(State(s): State<App>) -> Response {
    let (codecs, nvidia) = { let i = s.inner.lock().await; (i.codecs, i.nvidia.clone()) };
    match system::apply(codecs, &nvidia).await {
        Ok(reboot) => {
            if reboot { system::reboot().await; }
            QUIT.store(true, std::sync::atomic::Ordering::SeqCst);
            Json(json!({ "reboot": reboot })).into_response()
        }
        Err(e) => err("system", e.0),
    }
}
