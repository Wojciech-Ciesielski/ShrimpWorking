// Wbudowuje tłumaczenia z i18n/<przestrzeń>/ (_keys.tsv + <znacznik>.txt) dla aplikacji GTK Shrimp
// oraz tablice z i18n/langs.ts (jedno źródło prawdy, jak w apps/web-apps/build.rs).
use std::{env, fs, path::Path};

const NAMESPACES: &[&str] = &["shrimp-apps", "panko", "cocktail"];

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../i18n");
    println!("cargo:rerun-if-changed={}", root.join("langs.ts").display());
    let mut out = String::from("pub(crate) static NAMESPACES: &[(&str, &str, &[(&str, &str)])] = &[\n");
    for ns in NAMESPACES {
        let dir = root.join(ns);
        println!("cargo:rerun-if-changed={}", dir.display());
        let mut files: Vec<String> = fs::read_dir(&dir)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().into_owned()).collect())
            .unwrap_or_default();
        files.retain(|n| n.ends_with(".txt"));
        files.sort();
        let keys = fs::canonicalize(dir.join("_keys.tsv")).expect("_keys.tsv");
        out += &format!("    ({ns:?}, include_str!({:?}), &[\n", keys.display().to_string());
        for n in &files {
            let p = fs::canonicalize(dir.join(n)).unwrap();
            println!("cargo:rerun-if-changed={}", p.display());
            out += &format!("        ({:?}, include_str!({:?})),\n", n.trim_end_matches(".txt"), p.display().to_string());
        }
        out += "    ]),\n";
    }
    out += "];\n";
    let ts = fs::read_to_string(root.join("langs.ts")).expect("i18n/langs.ts");
    let (mut fallback, mut aliases, mut tags) = (String::new(), String::new(), String::new());
    for row in ts_rows(&ts, "const ROWS: Row[] = [") {
        let q = quoted(&row);
        let Some(tag) = q.first() else { continue };
        tags += &format!("    {tag:?},\n");
        if let Some(i) = row.find("text: \"") {
            fallback += &format!("    ({tag:?}, {:?}),\n", quoted(&row[i + 6..])[0]);
        }
        if let Some(i) = row.find("match: [") {
            let list = &row[i + 8..row[i..].find(']').map(|j| i + j).unwrap_or(row.len())];
            for m in quoted(list) {
                aliases += &format!("    ({m:?}, {tag:?}),\n");
            }
        }
    }
    let mut locales = String::new();
    for row in ts_rows(&ts, "export const GNOME_LOCALES: [locale: string, tag: string, name?: string][] = [") {
        let q = quoted(&row);
        if q.len() >= 2 {
            locales += &format!("    ({:?}, {:?}),\n", q[0], q[1]);
        }
    }
    out += &format!("pub(crate) static TAGS: &[&str] = &[\n{tags}];\n");
    out += &format!("pub(crate) static TEXT_FALLBACK: &[(&str, &str)] = &[\n{fallback}];\n");
    out += &format!("pub(crate) static ALIASES: &[(&str, &str)] = &[\n{aliases}];\n");
    out += &format!("pub(crate) static LOCALES: &[(&str, &str)] = &[\n{locales}];\n");
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("tables.rs"), out).unwrap();
}

/// Wiersze `[...]` tablicy zaczynającej się po `start` (zagnieżdżone nawiasy zostają w wierszu).
fn ts_rows(ts: &str, start: &str) -> Vec<String> {
    let Some(i) = ts.find(start) else { return vec![] };
    let (mut rows, mut cur, mut depth, mut in_str) = (vec![], String::new(), 0, false);
    for line in ts[i + start.len()..].lines() {
        if depth == 0 && line.trim_start().starts_with("//") {
            continue;
        }
        if depth == 0 && line.starts_with("];") {
            break;
        }
        for c in line.chars().chain(std::iter::once(' ')) {
            if c == '"' {
                in_str = !in_str;
            }
            if !in_str && c == '[' {
                depth += 1;
                if depth == 1 {
                    continue;
                }
            }
            if !in_str && c == ']' {
                depth -= 1;
                if depth == 0 {
                    rows.push(std::mem::take(&mut cur));
                    continue;
                }
            }
            if depth > 0 {
                cur.push(c);
            }
        }
    }
    rows
}

fn quoted(s: &str) -> Vec<String> {
    s.split('"').skip(1).step_by(2).map(String::from).collect()
}
