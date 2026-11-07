//! Teksty interfejsu z `i18n/webapps/` (ten sam format co Setup i Shrimp Install:
//! `_keys.tsv` = id⇥klucz⇥angielski, `<tag>.txt` = id⇥tłumaczenie, brak linii = angielski).
use std::collections::HashMap;
use std::sync::OnceLock;

const KEYS: &str = include_str!("../../../i18n/webapps/_keys.tsv");
const LANGS: &[(&str, &str)] = &[("pl", include_str!("../../../i18n/webapps/pl.txt"))];

/// Język z LANGUAGE / LC_ALL / LC_MESSAGES / LANG, np. „pl”.
pub fn lang() -> String {
    static LANG: OnceLock<String> = OnceLock::new();
    LANG.get_or_init(|| {
        for var in ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"] {
            if let Ok(v) = std::env::var(var) {
                let first = v.split(':').next().unwrap_or("");
                let tag = first.split(['.', '@']).next().unwrap_or("");
                if !tag.is_empty() && tag != "C" && tag != "POSIX" {
                    return tag.split('_').next().unwrap_or("en").to_lowercase();
                }
            }
        }
        "en".into()
    })
    .clone()
}

fn table() -> &'static HashMap<String, String> {
    static T: OnceLock<HashMap<String, String>> = OnceLock::new();
    T.get_or_init(|| build(&lang()))
}

fn build(lang: &str) -> HashMap<String, String> {
    let mut by_id: HashMap<&str, (&str, &str)> = HashMap::new();
    for line in KEYS.lines().filter(|l| !l.starts_with('#') && !l.trim().is_empty()) {
        let mut p = line.splitn(3, '\t');
        if let (Some(id), Some(key), Some(en)) = (p.next(), p.next(), p.next()) {
            by_id.insert(id, (key, en));
        }
    }
    let mut out: HashMap<String, String> =
        by_id.values().map(|(k, en)| (k.to_string(), en.to_string())).collect();
    if let Some((_, txt)) = LANGS.iter().find(|(t, _)| *t == lang) {
        for line in txt.lines() {
            if let Some((id, tr)) = line.split_once('\t') {
                if let Some((key, _)) = by_id.get(id) {
                    out.insert(key.to_string(), tr.to_string());
                }
            }
        }
    }
    out
}

pub fn tr(key: &str) -> String {
    table().get(key).cloned().unwrap_or_else(|| key.to_string())
}

/// `tr` z podstawieniem `{name}` itd.
pub fn trf(key: &str, args: &[(&str, &str)]) -> String {
    let mut s = tr(key);
    for (k, v) in args {
        s = s.replace(&format!("{{{k}}}"), v);
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polish_and_english() {
        assert_eq!(build("pl")["button.create"], "Utwórz");
        assert_eq!(build("en")["button.create"], "Create");
        assert_eq!(build("xx")["toast.created"], "{name} was added to your apps");
        // Każdy id z pl.txt ma klucz.
        let ids: Vec<&str> = KEYS.lines().filter(|l| !l.starts_with('#')).filter_map(|l| l.split('\t').next()).collect();
        for (_, txt) in LANGS {
            for l in txt.lines() {
                assert!(ids.contains(&l.split('\t').next().unwrap()), "{l}");
            }
        }
    }
}
