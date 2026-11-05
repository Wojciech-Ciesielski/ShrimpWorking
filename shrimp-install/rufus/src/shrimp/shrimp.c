/*
 * Shrimp Install: przebieg przygotowania nośnika i most do interfejsu.
 *
 *   start → pobranie ISO (fetch.c) → wybór nośnika i analiza ISO w Rufusie → START w Rufusie
 *         → kopia plików i shrimp.json (transfer.c) → gotowe → BootNext i restart (boot.c)
 *
 * Argumenty: --demo (dane z makiety), --source PLIK.iso (bez pobierania), --manifest URL,
 * --collect PLIK.json (tylko zebranie danych z Windows, bez okna), --rufus (zwykły Rufus),
 * --screen NAZWA i --theme light|dark (podgląd ekranów z makiety).
 *
 * Copyright © 2026 Shrimp. GPLv3.
 */
#define COBJMACROS
#include <windows.h>
#include <windowsx.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <stdio.h>
#include <string.h>
#include "shrimp.h"
#include "../rufus.h"
#include "../msapi_utf8.h"
#include "../drive.h"
#include "../resource.h"

extern DWORD WINAPI ImageScanThread(LPVOID param);
extern HANDLE format_thread;
extern BOOL enable_HDDs, no_confirmation_on_cancel;
extern RUFUS_DRIVE rufus_drive[MAX_DRIVES];
extern char ShrimpManifestOverride[1024];

BOOL shrimp_mode = TRUE;
BOOL ShrimpBitLockerOn = FALSE;
static BOOL opt_demo = FALSE;
static char opt_collect[MAX_PATH], opt_screen[32], opt_theme[16], opt_lang[64];

static enum { ST_IDLE, ST_FETCH, ST_SCAN, ST_FORMAT, ST_COPY, ST_DONE, ST_FAILED } state = ST_IDLE;
static DWORD plan_device;
static int cancel_id = 0;
static volatile LONG fail_sent = 0;
static char last_error[512];
static BOOL folders_started = FALSE;

/* ---------- argumenty ---------- */
void ShrimpInit(void)
{
	int argc = 0;
	wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
	for (int i = 1; argv != NULL && i < argc; i++) {
		const wchar_t* a = argv[i];
		const wchar_t* v = (i + 1 < argc) ? argv[i + 1] : NULL;
		if (wcscmp(a, L"--rufus") == 0)
			shrimp_mode = FALSE;
		else if (wcscmp(a, L"--demo") == 0)
			opt_demo = TRUE;
		else if (v != NULL && wcscmp(a, L"--source") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, ShrimpLocalIso, sizeof(ShrimpLocalIso), NULL, NULL);
		else if (v != NULL && wcscmp(a, L"--manifest") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, ShrimpManifestOverride, 1024, NULL, NULL);
		else if (v != NULL && wcscmp(a, L"--collect") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, opt_collect, sizeof(opt_collect), NULL, NULL);
		else if (v != NULL && wcscmp(a, L"--screen") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, opt_screen, sizeof(opt_screen), NULL, NULL);
		else if (v != NULL && wcscmp(a, L"--lang") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, opt_lang, sizeof(opt_lang), NULL, NULL);
		else if (v != NULL && wcscmp(a, L"--theme") == 0)
			WideCharToMultiByte(CP_UTF8, 0, argv[++i], -1, opt_theme, sizeof(opt_theme), NULL, NULL);
	}
	LocalFree(argv);
}

/* ---------- odpowiedzi i zdarzenia ---------- */
static void reply(int id, const char* result_json)
{
	char* s;
	size_t n;
	if (id <= 0)
		return;
	n = strlen(result_json ? result_json : "null") + 48;
	s = malloc(n);
	if (s == NULL)
		return;
	snprintf(s, n, "{\"id\":%d,\"ok\":true,\"result\":%s}", id, result_json ? result_json : "null");
	ShrimpEmit(s);
}

static void reply_error(int id, const char* message)
{
	jb b;
	jb_init(&b);
	jb_obj(&b, NULL);
	jb_num(&b, "id", id);
	jb_bool(&b, "ok", FALSE);
	jb_str(&b, "error", message);
	jb_end_obj(&b);
	ShrimpEmit(b.s);
}

uint64_t ShrimpSpeed(uint64_t done, BOOL reset)
{
	static uint64_t t_prev, d_prev;
	static double ema;
	uint64_t now = GetTickCount64();
	if (reset) {
		t_prev = now;
		d_prev = done;
		ema = 0;
		return 0;
	}
	if (now - t_prev >= 1000 && done >= d_prev) {
		double inst = (double)(done - d_prev) * 1000.0 / (double)(now - t_prev);
		ema = (ema > 0) ? ema * 0.7 + inst * 0.3 : inst;
		t_prev = now;
		d_prev = done;
	}
	return (uint64_t)ema;
}

void ShrimpProgress(int phase, uint64_t done, uint64_t total, uint64_t speed)
{
	static uint64_t last = 0;
	static int last_phase = 0;
	char* s;
	uint64_t now = GetTickCount64();
	if (phase == last_phase && done < total && now - last < 150)
		return;
	last = now;
	last_phase = phase;
	s = malloc(160);
	if (s == NULL)
		return;
	snprintf(s, 160, "{\"event\":\"progress\",\"phase\":%d,\"done\":%llu,\"total\":%llu,\"speed\":%llu}",
		phase, (unsigned long long)done, (unsigned long long)total, (unsigned long long)speed);
	ShrimpEmit(s);
}

void ShrimpFail(int phase, const char* kind, const char* message)
{
	jb b;
	if (InterlockedExchange(&fail_sent, 1) != 0)
		return;
	uprintf("Shrimp: błąd w fazie %d: %s %s", phase, kind, message ? message : "");
	jb_init(&b);
	jb_obj(&b, NULL);
	jb_str(&b, "event", "fail");
	jb_num(&b, "phase", phase);
	jb_str(&b, "kind", kind);
	if (message != NULL && message[0])
		jb_str(&b, "message", message);
	jb_end_obj(&b);
	ShrimpEmit(b.s);
}

/* ---------- nośniki ---------- */
static const char* kind_name[] = { "usb", "sd", "disk" };

static void devices_json(jb* b)
{
	char name[256], *p;
	jb_arr(b, NULL);
	for (int i = 0; i < MAX_DRIVES && rufus_drive[i].size != 0; i++) {
		static_strcpy(name, rufus_drive[i].display_name ? rufus_drive[i].display_name : rufus_drive[i].name);
		/* „SanDisk Ultra USB Device (E:) [29.8 GB]” → „SanDisk Ultra (E:)” */
		if ((p = strrchr(name, '[')) != NULL) {
			*p = 0;
			while (p > name && p[-1] == ' ')
				*--p = 0;
		}
		if ((p = strstr(name, " USB Device")) != NULL)
			memmove(p, p + 11, strlen(p + 11) + 1);
		jb_obj(b, NULL);
		jb_num(b, "id", rufus_drive[i].index);
		jb_str(b, "name", name);
		jb_str(b, "kind", kind_name[min(rufus_drive[i].shrimp_kind, 2)]);
		jb_u64(b, "size", rufus_drive[i].size);
		jb_end_obj(b);
	}
	jb_end_arr(b);
}

void ShrimpOnDevicesChanged(void)
{
	jb b;
	if (!shrimp_mode || hShrimpWnd == NULL)
		return;
	jb d;
	jb_init(&d);
	devices_json(&d);
	jb_init(&b);
	jb_obj(&b, NULL);
	jb_str(&b, "event", "devices");
	jb_raw(&b, "devices", d.s);
	jb_end_obj(&b);
	jb_free(&d);
	ShrimpEmit(b.s);
}

/* ---------- foldery ---------- */
static uint64_t folder_size[SF_MAX];
static BOOL folder_known[SF_MAX];

static char* folders_json(BOOL sizes)
{
	jb b;
	wchar_t path[MAX_PATH];
	jb_init(&b);
	jb_arr(&b, NULL);
	for (int i = 0; i < SF_MAX; i++) {
		if (!ShrimpFolderPath(i, path, ARRAYSIZE(path)))
			continue;
		jb_obj(&b, NULL);
		jb_str(&b, "key", shrimp_folder_key[i]);
		jb_wstr(&b, "path", path);
		if (sizes && folder_known[i])
			jb_u64(&b, "size", folder_size[i]);
		else
			jb_null(&b, "size");
		jb_end_obj(&b);
	}
	jb_end_arr(&b);
	return b.s;
}

static DWORD WINAPI FoldersThread(LPVOID param)
{
	wchar_t path[MAX_PATH];
	(void)param;
	CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
	for (int i = 0; i < SF_MAX; i++) {
		folder_size[i] = ShrimpFolderPath(i, path, ARRAYSIZE(path)) ? ShrimpTreeSize(path, NULL) : 0;
		folder_known[i] = TRUE;
		char* f = folders_json(TRUE);
		size_t n = strlen(f) + 40;
		char* s = malloc(n);
		if (s != NULL) {
			snprintf(s, n, "{\"event\":\"folders\",\"folders\":%s}", f);
			ShrimpEmit(s);
		}
		free(f);
	}
	return 0;
}

static DWORD WINAPI BitLockerThread(LPVOID param)
{
	(void)param;
	ShrimpBitLockerOn = ShrimpBitLocker();
	if (ShrimpBitLockerOn)
		ShrimpEmit(_strdup("{\"event\":\"bitlocker\",\"on\":true}"));
	return 0;
}

/* ---------- wybór plików i folderów ---------- */
typedef struct { int id; int count; wchar_t* paths[64]; BOOL folder; } pick_job;

static DWORD WINAPI PickSizeThread(LPVOID param)
{
	pick_job* j = param;
	jb b;
	jb_init(&b);
	jb_arr(&b, NULL);
	for (int i = 0; i < j->count; i++) {
		const wchar_t* name = wcsrchr(j->paths[i], L'\\');
		jb_obj(&b, NULL);
		jb_wstr(&b, "path", j->paths[i]);
		jb_wstr(&b, "name", name && name[1] ? name + 1 : j->paths[i]);
		jb_str(&b, "kind", j->folder ? "folder" : "file");
		jb_u64(&b, "size", ShrimpTreeSize(j->paths[i], NULL));
		jb_end_obj(&b);
		CoTaskMemFree(j->paths[i]);
	}
	jb_end_arr(&b);
	reply(j->id, b.s);
	jb_free(&b);
	free(j);
	return 0;
}

static void pick(int id, BOOL folder)
{
	IFileOpenDialog* d = NULL;
	IShellItemArray* items = NULL;
	DWORD opts = 0, n = 0;
	pick_job* j = calloc(1, sizeof(*j));
	if (j == NULL || FAILED(CoCreateInstance(&CLSID_FileOpenDialog, NULL, CLSCTX_INPROC_SERVER, &IID_IFileOpenDialog, (void**)&d))) {
		free(j);
		reply(id, "[]");
		return;
	}
	j->id = id;
	j->folder = folder;
	IFileOpenDialog_GetOptions(d, &opts);
	IFileOpenDialog_SetOptions(d, opts | FOS_ALLOWMULTISELECT | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | (folder ? FOS_PICKFOLDERS : FOS_FILEMUSTEXIST));
	IFileOpenDialog_SetTitle(d, folder ? L"Dodaj folder" : L"Dodaj plik");
	if (SUCCEEDED(IFileOpenDialog_Show(d, hShrimpWnd)) && SUCCEEDED(IFileOpenDialog_GetResults(d, &items))) {
		IShellItemArray_GetCount(items, &n);
		for (DWORD i = 0; i < n && j->count < 64; i++) {
			IShellItem* it = NULL;
			PWSTR p = NULL;
			if (SUCCEEDED(IShellItemArray_GetItemAt(items, i, &it)) && SUCCEEDED(IShellItem_GetDisplayName(it, SIGDN_FILESYSPATH, &p)))
				j->paths[j->count++] = p;
			if (it)
				IShellItem_Release(it);
		}
		IShellItemArray_Release(items);
	}
	IFileOpenDialog_Release(d);
	if (CreateThread(NULL, 0, PickSizeThread, j, 0, NULL) == NULL) {
		reply(id, "[]");
		free(j);
	}
}

/* ---------- przebieg ---------- */
static void begin(int id, char** f, int nf)
{
	shrimp_transfer* t = &ShrimpTransfer;
	wchar_t path[MAX_PATH];

	if (state == ST_FETCH || state == ST_SCAN || state == ST_FORMAT || state == ST_COPY) {
		reply_error(id, "busy");
		return;
	}
	for (int i = 0; i < t->count; i++)
		free(t->items[i].source);
	memset(t, 0, sizeof(*t));
	plan_device = (nf > 2) ? (DWORD)strtoul(f[2], NULL, 10) : 0;
	t->DriveIndex = plan_device;
	/* Moje foldery: klucze po przecinku. */
	if (nf > 3 && f[3][0]) {
		char keys[256], *tok, *ctx = NULL;
		static_strcpy(keys, f[3]);
		for (tok = strtok_s(keys, ",", &ctx); tok && t->count < 64; tok = strtok_s(NULL, ",", &ctx)) {
			for (int k = 0; k < SF_MAX; k++) {
				if (strcmp(tok, shrimp_folder_key[k]) == 0 && ShrimpFolderPath(k, path, ARRAYSIZE(path))) {
					shrimp_item* it = &t->items[t->count++];
					it->source = _wcsdup(path);
					static_strcpy(it->key, shrimp_folder_key[k]);
					static_sprintf(it->dest, "files/%s", shrimp_folder_key[k]);
				}
			}
		}
	}
	/* Wybiorę sam: ścieżki, do files/other/<nazwa> (bez powtórzeń nazw). */
	for (int i = 4; i < nf && t->count < 64; i++) {
		shrimp_item* it = &t->items[t->count];
		const char* base = strrchr(f[i], '\\');
		char name[MAX_PATH];
		base = base ? base + 1 : f[i];
		static_strcpy(name, base);
		for (int k = 2; ; k++) {
			BOOL dup = FALSE;
			for (int j = 0; j < t->count; j++)
				if (_stricmp(t->items[j].dest + (strncmp(t->items[j].dest, "files/other/", 12) == 0 ? 12 : 0), name) == 0)
					dup = TRUE;
			if (!dup)
				break;
			static_sprintf(name, "%s (%d)", base, k);
		}
		it->source = utf8_to_wchar(f[i]);
		if (it->source == NULL)
			continue;
		static_strcpy(it->key, "other");
		static_sprintf(it->dest, "files/other/%s", name);
		t->count++;
	}

	ShrimpCancel = FALSE;
	fail_sent = 0;
	last_error[0] = 0;
	state = ST_FETCH;
	reply(id, "null");
	if (CreateThread(NULL, 0, ShrimpFetchThread, NULL, 0, NULL) == NULL) {
		state = ST_FAILED;
		ShrimpFail(1, "other", "startFail");
	}
}

static int device_row(DWORD index)
{
	for (int i = 0; i < ComboBox_GetCount(hDeviceList); i++)
		if ((DWORD)ComboBox_GetItemData(hDeviceList, i) == index)
			return i;
	return -1;
}

static BOOL select_data(HWND combo, int ctrl, int data)
{
	for (int i = 0; i < ComboBox_GetCount(combo); i++) {
		if ((int)ComboBox_GetItemData(combo, i) == data) {
			if (ComboBox_GetCurSel(combo) != i) {
				ComboBox_SetCurSel(combo, i);
				SendMessage(hMainDialog, WM_COMMAND, MAKEWPARAM(ctrl, CBN_SELCHANGE), (LPARAM)combo);
			}
			return TRUE;
		}
	}
	return FALSE;
}

static void finish_cancel(void)
{
	state = ST_IDLE;
	if (cancel_id) {
		reply(cancel_id, "null");
		cancel_id = 0;
	}
}

static void cancel(int id)
{
	if (state != ST_FETCH && state != ST_SCAN && state != ST_FORMAT && state != ST_COPY) {
		state = ST_IDLE;
		reply(id, "null");
		return;
	}
	cancel_id = id;
	ShrimpCancel = TRUE;
	if (state == ST_FORMAT && (format_thread != NULL || op_in_progress)) {
		no_confirmation_on_cancel = TRUE;
		SendMessage(hMainDialog, WM_COMMAND, IDCANCEL, 0);
	}
}

LRESULT ShrimpWndMessage(UINT msg, WPARAM wParam, LPARAM lParam)
{
	switch (msg) {
	case WM_SHRIMP_CALL: {
		char* m = (char*)lParam;
		char* f[72];
		int nf = 0;
		for (char *p = m, *s = m; nf < 72; p++) {
			if (*p == '\t' || *p == 0) {
				BOOL end = (*p == 0);
				*p = 0;
				f[nf++] = s;
				s = p + 1;
				if (end)
					break;
			}
		}
		int id = nf > 0 ? atoi(f[0]) : 0;
		const char* call = nf > 1 ? f[1] : "";
		if (strcmp(call, "info") == 0) {
			jb b;
			char* fj = folders_json(TRUE);
			jb_init(&b);
			jb_obj(&b, NULL);
			jb_bool(&b, "bitlocker", ShrimpBitLockerOn);
			jb_u64(&b, "shrimpSize", ShrimpManifest.size ? ShrimpManifest.size : SHRIMP_ISO_ESTIMATE);
			jb_u64(&b, "minSize", SHRIMP_MIN_MEDIA_SIZE);
			jb_raw(&b, "folders", fj);
			jb_end_obj(&b);
			reply(id, b.s);
			jb_free(&b);
			free(fj);
			if (!folders_started) {
				folders_started = TRUE;
				CreateThread(NULL, 0, FoldersThread, NULL, 0, NULL);
			}
		} else if (strcmp(call, "devices") == 0) {
			jb b;
			jb_init(&b);
			devices_json(&b);
			reply(id, b.s);
			jb_free(&b);
		} else if (strcmp(call, "pick") == 0) {
			pick(id, nf > 2 && strcmp(f[2], "folder") == 0);
		} else if (strcmp(call, "start") == 0) {
			begin(id, f, nf);
		} else if (strcmp(call, "cancel") == 0) {
			cancel(id);
		} else if (strcmp(call, "reboot") == 0) {
			const char* err = ShrimpSetBootNext(plan_device);
			if (err != NULL) {
				reply_error(id, err);
			} else {
				ShrimpDisableFastStartup();
				if (ShrimpReboot())
					reply(id, "null");
				else
					reply_error(id, "rebootFail");
			}
		} else if (strcmp(call, "later") == 0 || strcmp(call, "close") == 0) {
			PostMessage(hShrimpWnd, WM_CLOSE, 0, 0);
		} else if (strcmp(call, "minimize") == 0) {
			ShowWindow(hShrimpWnd, SW_MINIMIZE);
		} else if (strcmp(call, "drag") == 0) {
			ReleaseCapture();
			SendMessage(hShrimpWnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
		}
		free(m);
		return 0;
	}

	case WM_SHRIMP_FETCHED:
		if (ShrimpCancel) {
			finish_cancel();
			break;
		}
		if (!wParam) {
			state = ST_FAILED;
			ShrimpFail(1, "other", NULL);
			break;
		}
		/* Nośnik wybrany w interfejsie → ten sam w Rufusie, potem analiza ISO. */
		{
			int row = device_row(plan_device);
			if (row < 0) {
				state = ST_FAILED;
				ShrimpFail(2, "device", NULL);
				break;
			}
			ComboBox_SetCurSel(hDeviceList, row);
			SendMessage(hMainDialog, WM_COMMAND, MAKEWPARAM(IDC_DEVICE, CBN_SELCHANGE), (LPARAM)hDeviceList);
		}
		state = ST_SCAN;
		ShrimpProgress(2, 0, 100, 0);
		free(image_path);
		image_path = _strdup(ShrimpIsoPath);
		ErrorStatus = 0;
		if (CreateThread(NULL, 0, ImageScanThread, NULL, 0, NULL) == NULL) {
			state = ST_FAILED;
			ShrimpFail(2, "write", NULL);
		}
		break;

	case WM_SHRIMP_SCANNED:
		if (ShrimpCancel) {
			finish_cancel();
			break;
		}
		if (!wParam) {
			state = ST_FAILED;
			ShrimpFail(2, "write", "imageBad");
			break;
		}
		/* Nośnik jak dla Shrimp: GPT, UEFI, FAT32 (Setup dopisuje pliki z Windows). */
		select_data(hPartitionScheme, IDC_PARTITION_TYPE, PARTITION_STYLE_GPT);
		select_data(hTargetSystem, IDC_TARGET_SYSTEM, TT_UEFI);
		if (!img_report.has_4GB_file)
			select_data(hFileSystem, IDC_FILE_SYSTEM, FS_FAT32);
		else
			uprintf("Shrimp: UWAGA: obraz ma plik > 4 GB, Rufus wybierze inny system plików");
		state = ST_FORMAT;
		ShrimpSpeed(0, TRUE);
		SendMessage(hMainDialog, WM_COMMAND, IDC_START, 0);
		break;

	case WM_SHRIMP_FORMATTED:
		if (ShrimpCancel || SCODE_CODE((DWORD)wParam) == ERROR_CANCELLED) {
			finish_cancel();
			break;
		}
		if (IS_ERROR((DWORD)wParam)) {
			state = ST_FAILED;
			ShrimpFail(2, "write", last_error[0] ? last_error : NULL);
			break;
		}
		ShrimpProgress(2, 100, 100, 0);
		/* Pobrany obraz już niepotrzebny (zostawiamy tylko wskazany przez --source). */
		if (!ShrimpLocalIso[0])
			DeleteFileU(ShrimpIsoPath);
		state = ST_COPY;
		if (CreateThread(NULL, 0, ShrimpCopyThread, NULL, 0, NULL) == NULL) {
			state = ST_FAILED;
			ShrimpFail(3, "copy", NULL);
		}
		break;

	case WM_SHRIMP_COPIED:
		if (ShrimpCancel) {
			finish_cancel();
			break;
		}
		if (!wParam) {
			state = ST_FAILED;
			ShrimpFail(3, "copy", NULL);
			break;
		}
		state = ST_DONE;
		ShrimpEmit(_strdup("{\"event\":\"done\"}"));
		break;
	}
	return 0;
}

void ShrimpDispatch(const char* msg)
{
	/* Obsługa poza wywołaniem zwrotnym WebView2 (okna dialogowe, długie operacje). */
	char* m = _strdup(msg);
	if (m != NULL && !PostMessage(hShrimpWnd, WM_SHRIMP_CALL, 0, (LPARAM)m))
		free(m);
}

BOOL ShrimpCanClose(void)
{
	return state != ST_FETCH && state != ST_SCAN && state != ST_FORMAT && state != ST_COPY;
}

/* ---------- punkty zaczepienia w Rufusie ---------- */
int ShrimpNotification(int type, const char* title, const char* message)
{
	uprintf("Shrimp: komunikat Rufusa (odpowiedź automatyczna): %s: %s", title ? title : "", message ? message : "");
	if ((type & MB_ICONERROR) == MB_ICONERROR && message != NULL) {
		static_strcpy(last_error, message);
		for (char* p = last_error; *p; p++)
			if (*p == '\r' || *p == '\n')
				*p = ' ';
	}
	switch (type & 0x0F) {
	case MB_OKCANCEL:
		return IDOK;
	case MB_YESNO:
	case MB_YESNOCANCEL:
		return IDYES;
	default:
		return IDOK;
	}
}

int ShrimpSelection(const char* title, const char* message, int choices)
{
	(void)choices;
	/* Pierwsza opcja: dla obrazów ISOHybrid to tryb ISO (pliki na FAT32, miejsce na kopię z Windows). */
	uprintf("Shrimp: wybór Rufusa (pierwsza opcja): %s: %s", title ? title : "", message ? message : "");
	return 1;
}

void ShrimpOnImageScanned(BOOL ok)
{
	if (shrimp_mode && hShrimpWnd != NULL && state == ST_SCAN)
		PostMessage(hShrimpWnd, WM_SHRIMP_SCANNED, ok && img_report.is_iso, 0);
}

void ShrimpOnProgress(int pos, int max)
{
	uint64_t size;
	if (!shrimp_mode || state != ST_FORMAT || max <= 0)
		return;
	size = ShrimpManifest.size ? ShrimpManifest.size : SHRIMP_ISO_ESTIMATE;
	uint64_t done = size * (uint64_t)pos / (uint64_t)max;
	ShrimpProgress(2, done, size, ShrimpSpeed(done, FALSE));
}

void ShrimpOnFormatDone(DWORD error_status)
{
	if (shrimp_mode && hShrimpWnd != NULL && state == ST_FORMAT)
		PostMessage(hShrimpWnd, WM_SHRIMP_FORMATTED, (WPARAM)error_status, 0);
}

static void collect_only(void)
{
	jb b;
	HANDLE h;
	DWORD w;
	char* f;
	CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
	ShrimpBitLockerOn = ShrimpBitLocker();
	for (int i = 0; i < SF_MAX; i++) {
		wchar_t path[MAX_PATH];
		folder_size[i] = ShrimpFolderPath(i, path, ARRAYSIZE(path)) ? ShrimpTreeSize(path, NULL) : 0;
		folder_known[i] = TRUE;
	}
	jb_init(&b);
	jb_obj(&b, NULL);
	jb_num(&b, "version", 1);
	jb_str(&b, "installer", "Shrimp Install " SHRIMP_VERSION);
	ShrimpCollect(&b);
	f = folders_json(TRUE);
	jb_raw(&b, "folders", f);
	free(f);
	{
		jb d;
		jb_init(&d);
		devices_json(&d);
		jb_raw(&b, "devices", d.s);
		jb_free(&d);
	}
	jb_end_obj(&b);
	h = CreateFileU(opt_collect, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
	if (h != INVALID_HANDLE_VALUE) {
		WriteFile(h, b.s, (DWORD)b.len, &w, NULL);
		CloseHandle(h);
	}
	jb_free(&b);
	ExitProcess(h != INVALID_HANDLE_VALUE ? 0 : 1);
}

BOOL ShrimpStart(HINSTANCE hInstance, HWND hMainDlg)
{
	jb o;
	(void)hMainDlg;
	if (!shrimp_mode)
		return FALSE;
	/* Pendrive'y, karty SD i dyski zewnętrzne USB (dyski wewnętrzne Rufus pomija zawsze). */
	enable_HDDs = TRUE;
	GetDevices(0);
	if (opt_collect[0])
		collect_only();

	jb_init(&o);
	jb_obj(&o, NULL);
	jb_bool(&o, "demo", opt_demo);
	if (opt_screen[0])
		jb_str(&o, "screen", opt_screen);
	if (opt_theme[0])
		jb_str(&o, "theme", opt_theme);
	/* Język: --lang wygrywa, w innym wypadku języki interfejsu Windows (w kolejności preferencji użytkownika). */
	if (opt_lang[0])
		jb_str(&o, "lang", opt_lang);
	{
		ULONG n = 0, len = 0;
		if (GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &n, NULL, &len) && len > 1) {
			wchar_t* buf = calloc(len, sizeof(wchar_t));
			if (buf != NULL && GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &n, buf, &len)) {
				jb_arr(&o, "langs");
				for (const wchar_t* p = buf; *p; p += wcslen(p) + 1) {
					char u[64];
					if (WideCharToMultiByte(CP_UTF8, 0, p, -1, u, sizeof(u), NULL, NULL) > 0)
						jb_str(&o, NULL, u);
				}
				jb_end_arr(&o);
			}
			free(buf);
		}
	}
	jb_end_obj(&o);
	BOOL ok = ShrimpWindowCreate(hInstance, o.s);
	jb_free(&o);
	if (ok && !opt_demo)
		CreateThread(NULL, 0, BitLockerThread, NULL, 0, NULL);
	return TRUE;
}
