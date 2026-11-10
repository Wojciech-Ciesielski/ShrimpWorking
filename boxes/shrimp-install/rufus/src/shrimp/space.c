/*
 * Shrimp Install: miejsce dla Shrimp na dysku z Windows („Obok Windows”).
 *
 * Partycję systemową (C:) zmniejsza sam Windows, modułem Storage PowerShella:
 *   Get-PartitionSupportedSize  najmniejszy możliwy rozmiar (pliki, których Windows nie przesunie: MFT, plik
 *                               stronicowania, hibernacji, kopie w tle),
 *   Resize-Partition            zmniejszenie bez restartu; działa też na woluminie z BitLockerem
 *                               (szyfrowanie zostaje, Linux nigdy nie musi go dotykać).
 * Za C: zostaje nieprzydzielone miejsce, a Setup instaluje tam Shrimp, nie zmieniając Windows
 * (boxes/setup/web/src/backend/agama.ts: dysk z wolnym miejscem).
 *
 * Zmniejszenie to ostatni krok przygotowania (faza 4), po zapisie nośnika i kopii plików: przerwanie
 * wcześniej nie zostawia zmian w Windows. Cofnąć można w Zarządzaniu dyskami („Rozszerz wolumin”).
 *
 * Test w CI: shrimp-install.exe --shrink-test LITERA BAJTY (wirtualny dysk z NTFS).
 *
 * Copyright © 2026 Shrimp. GPLv3.
 */
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <wctype.h>
#include "shrimp.h"
#include "../rufus.h"
#include "../msapi_utf8.h"

shrimp_disk ShrimpDisk;
uint64_t ShrimpShrinkBytes = 0;

/* Ścieżka w poleceniu PowerShell w apostrofach: apostrof podwójnie (np. C:\Users\O'Brien). */
static void ps_quote(const char* in, char* out, size_t n)
{
	size_t j = 0;
	for (size_t i = 0; in[i] && j + 2 < n; i++) {
		if (in[i] == '\'')
			out[j++] = '\'';
		out[j++] = in[i];
	}
	out[j] = 0;
}

static BOOL read_small(const char* path, char* out, size_t n)
{
	HANDLE h = CreateFileU(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
	DWORD r = 0;
	if (h == INVALID_HANDLE_VALUE)
		return FALSE;
	BOOL ok = ReadFile(h, out, (DWORD)n - 1, &r, NULL);
	CloseHandle(h);
	out[ok ? r : 0] = 0;
	/* UTF-8 BOM z Set-Content -Encoding utf8 (Windows PowerShell 5). */
	if ((unsigned char)out[0] == 0xEF && (unsigned char)out[1] == 0xBB && (unsigned char)out[2] == 0xBF)
		memmove(out, out + 3, strlen(out + 3) + 1);
	for (char* p = out; *p; p++)
		if (*p == '\r' || *p == '\n')
			*p = ' ';
	return ok;
}

/* Uruchamia skrypt PowerShell; wynik (stdout skryptu zapisany przez Set-Content) w out, błąd w err. Kod wyjścia. */
static DWORD run_ps(const char* script_fmt, char letter, uint64_t arg, char* out, size_t nout, char* err, size_t nerr)
{
	char tmp[MAX_PATH], res[MAX_PATH], res_err[MAX_PATH], q[2 * MAX_PATH], qe[2 * MAX_PATH], script[2048], cmd[4096];
	GetTempPathU(sizeof(tmp), tmp);
	static_sprintf(res, "%sshrimp-space-%lu.txt", tmp, GetCurrentProcessId());
	static_sprintf(res_err, "%s.err", res);
	DeleteFileU(res);
	DeleteFileU(res_err);
	ps_quote(res, q, sizeof(q));
	ps_quote(res_err, qe, sizeof(qe));
	/* script_fmt: %c litera, %llu argument, %s plik wyniku. */
	static_sprintf(script, script_fmt, letter, (unsigned long long)arg, q);
	static_sprintf(cmd, "%s\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "
		"\"$ErrorActionPreference = 'Stop'; try { %s } catch { $_.Exception.Message | Set-Content -Encoding utf8 -LiteralPath '%s'; exit 5 }\"",
		system_dir, script, qe);
	DWORD r = RunCommand(cmd, NULL, FALSE);
	if (out != NULL)
		read_small(res, out, nout);
	if (err != NULL && !read_small(res_err, err, nerr))
		err[0] = 0;
	DeleteFileU(res);
	DeleteFileU(res_err);
	return r;
}

BOOL ShrimpDiskQuery(char letter, shrimp_disk* d)
{
	char out[512] = "", err[512] = "";
	unsigned long long size = 0, min = 0, max = 0, disk = 0, free = 0;
	memset(d, 0, sizeof(*d));
	d->letter = letter;
	DWORD r = run_ps(
		"$p = Get-Partition -DriveLetter %c; $null = %llu; "
		"$s = $p | Get-PartitionSupportedSize; $d = $p | Get-Disk; "
		"('{0} {1} {2} {3} {4}' -f $p.Size, $s.SizeMin, $s.SizeMax, $d.Size, $d.LargestFreeExtent) | Set-Content -Encoding ascii -LiteralPath '%s'",
		letter, 0, out, sizeof(out), err, sizeof(err));
	if (r != 0 || sscanf(out, "%llu %llu %llu %llu %llu", &size, &min, &max, &disk, &free) != 5 || size == 0 || min == 0) {
		static_strcpy(d->error, err[0] ? err : "query");
		uprintf("Shrimp: dysk %c: brak rozmiarów (%lu): %s", letter, r, d->error);
		return FALSE;
	}
	d->size = size; d->min = min; d->max = max; d->disk = disk; d->free = free;
	d->ok = TRUE;
	uprintf("Shrimp: dysk %c: partycja %llu B, najmniej %llu B, najwięcej %llu B, dysk %llu B, wolne %llu B",
		letter, size, min, max, disk, free);
	return TRUE;
}

/* Docelowy rozmiar C: dla `want` bajtów wolnego miejsca (w pełnych MiB); 0: miejsce już jest.
 * Wolne miejsce w innym kawałku dysku się nie sumuje (Setup instaluje w jednym obszarze), więc zmniejszamy o całe `want`. */
uint64_t ShrimpShrinkTarget(const shrimp_disk* d, uint64_t want)
{
	const uint64_t MiB = 1024 * 1024;
	if (want == 0 || d->free >= want)
		return 0;
	if (want >= d->size)
		return MiB;   /* i tak poniżej minimum: wołający zgłosi shrinkMin */
	return ((d->size - want) / MiB) * MiB;
}

const char* ShrimpShrink(char letter, uint64_t want)
{
	static char error[600];
	shrimp_disk d;
	char err[512] = "";
	if (!ShrimpDiskQuery(letter, &d))
		return "shrinkQuery";
	uint64_t target = ShrimpShrinkTarget(&d, want);
	if (target == 0) {
		uprintf("Shrimp: na dysku jest już %llu B wolnego miejsca, C: bez zmian", (unsigned long long)d.free);
		return NULL;
	}
	if (target < d.min) {
		uprintf("Shrimp: C: nie zmniejszy się do %llu B (najmniej %llu B)", (unsigned long long)target, (unsigned long long)d.min);
		return "shrinkMin";
	}
	uprintf("Shrimp: zmniejszam %c: z %llu B do %llu B", letter, (unsigned long long)d.size, (unsigned long long)target);
	DWORD r = run_ps("Resize-Partition -DriveLetter %c -Size %llu; 'ok' | Set-Content -Encoding ascii -LiteralPath '%s'",
		letter, target, NULL, 0, err, sizeof(err));
	shrimp_disk after;
	if (!ShrimpDiskQuery(letter, &after) || after.size > target + 1024 * 1024) {
		uprintf("Shrimp: zmniejszenie się nie udało (%lu): %s", r, err[0] ? err : "-");
		static_sprintf(error, "shrinkFail%s%s", err[0] ? ":" : "", err);
		/* Dwukropek rozdziela kod i argument w interfejsie: komunikat Windows bez dwukropków. */
		for (char* p = error + 10 + (err[0] ? 1 : 0); *p; p++)
			if (*p == ':')
				*p = ' ';
		return error;
	}
	uprintf("Shrimp: %c: ma teraz %llu B, wolne na dysku %llu B", letter, (unsigned long long)after.size, (unsigned long long)after.free);
	ShrimpDisk = after;
	return NULL;
}

/* Rozmiary C: dla ekranu „Gdzie zainstalować Shrimp?” (Get-PartitionSupportedSize trwa do kilkudziesięciu sekund). */
DWORD WINAPI ShrimpDiskThread(LPVOID param)
{
	jb b;
	char sys[MAX_PATH] = "C:";
	(void)param;
	shrimp_disk d;
	GetEnvironmentVariableA("SystemDrive", sys, sizeof(sys));
	/* Najpierw do zmiennej lokalnej: „info” w tym czasie nie widzi wypełnionego w połowie ShrimpDisk. */
	ShrimpDiskQuery(sys[0], &d);
	ShrimpDisk = d;
	jb_init(&b);
	jb_obj(&b, NULL);
	jb_str(&b, "event", "disk");
	ShrimpDiskJson(&b, "disk");
	jb_end_obj(&b);
	ShrimpEmit(b.s);   /* przejmuje b.s */
	return 0;
}

void ShrimpDiskJson(jb* b, const char* key)
{
	char letter[2] = { ShrimpDisk.letter, 0 };
	jb_obj(b, key);
	jb_bool(b, "ok", ShrimpDisk.ok);
	jb_str(b, "letter", letter);
	jb_u64(b, "size", ShrimpDisk.size);
	jb_u64(b, "min", ShrimpDisk.min);
	jb_u64(b, "disk", ShrimpDisk.disk);
	jb_u64(b, "free", ShrimpDisk.free);
	jb_end_obj(b);
}

/* Faza 4: zmniejszenie C: o ShrimpShrinkBytes. Kończy WM_SHRIMP_SHRUNK (lParam: kod błędu, malloc, albo NULL). */
DWORD WINAPI ShrimpShrinkThread(LPVOID param)
{
	char sys[MAX_PATH] = "C:";
	(void)param;
	GetEnvironmentVariableA("SystemDrive", sys, sizeof(sys));
	const char* e = ShrimpShrink(sys[0], ShrimpShrinkBytes);
	PostMessage(hShrimpWnd, WM_SHRIMP_SHRUNK, e == NULL, (LPARAM)(e != NULL ? _strdup(e) : NULL));
	return 0;
}

/* --shrink-test LITERA BAJTY (CI): zmniejszenie na dysku testowym; wynik w dzienniku i w kodzie wyjścia:
 * 0 wolne miejsce jest, 2 brak rozmiarów, 3 zmniejszenie się nie udało, 4 za mało wolnego miejsca po zmniejszeniu. */
int ShrimpShrinkTest(const wchar_t* letter, const wchar_t* bytes)
{
	shrimp_disk d;
	char l = (char)towupper(letter[0]);
	uint64_t want = _wcstoui64(bytes, NULL, 10);
	if (!ShrimpDiskQuery(l, &d))
		return 2;
	if (ShrimpShrink(l, want) != NULL)
		return 3;
	if (!ShrimpDiskQuery(l, &d))
		return 2;
	return d.free >= want ? 0 : 4;
}
