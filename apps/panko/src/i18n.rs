//! Teksty interfejsu z `i18n/panko/` (wspólny format Shrimp, zob. apps/shrimp-i18n).
//! W testach zawsze po polsku, żeby asercje nie zależały od języka maszyny.
const NS: &str = "panko";

#[cfg(not(test))]
const LANG: Option<&str> = None;
#[cfg(test)]
const LANG: Option<&str> = Some("pl");

pub fn tr(key: &'static str) -> &'static str {
    match LANG {
        Some(l) => shrimp_i18n::tr_in(NS, l, key),
        None => shrimp_i18n::tr(NS, key),
    }
}

/// `tr` z podstawieniem `{name}` itd.
pub fn trf(key: &'static str, args: &[(&str, &str)]) -> String {
    shrimp_i18n::fill(tr(key), args)
}

/// Liczba mnoga: klucze `<key>.one/.few/.many/.other`, `{n}` = liczba.
#[allow(dead_code)] // nie każda aplikacja ma teksty z liczbą mnogą
pub fn trn(key: &str, n: u64, args: &[(&str, &str)]) -> String {
    match LANG {
        Some(l) => shrimp_i18n::trn_in(NS, l, key, n, args),
        None => shrimp_i18n::trn(NS, key, n, args),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn translations_consistent() {
        let bad = shrimp_i18n::check(super::NS);
        assert!(bad.is_empty(), "{bad:#?}");
    }
}
