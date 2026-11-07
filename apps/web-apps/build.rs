// Wbudowuje ikony z data/icons/*.png (pobiera je tools/verify.py w CI) w bibliotekę,
// żeby lista i tworzenie aplikacji działały bez sieci.
use std::{env, fs, path::Path};

fn main() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("data/icons");
    println!("cargo:rerun-if-changed={}", dir.display());
    println!("cargo:rerun-if-changed=data/webapps.json");
    let mut names: Vec<String> = fs::read_dir(&dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|n| n.ends_with(".png"))
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    let mut out = String::from("pub(crate) static ICONS: &[(&str, &[u8])] = &[\n");
    for n in names {
        let id = n.trim_end_matches(".png");
        out += &format!("    ({id:?}, include_bytes!({:?})),\n", dir.join(&n).display().to_string());
    }
    out += "];\n";
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("icons.rs"), out).unwrap();
}
