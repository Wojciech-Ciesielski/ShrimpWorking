// Shrimp Setup Guard: while Shrimp is being installed (live session) or set up for the first time
// (after the first restart), Setup is the only thing on screen. Before the Setup window shows up,
// and whenever it is gone, a black cover with the Shrimp logo hides the desktop. Window switching and
// other shell shortcuts are blocked, notification banners are held back. When the first-boot marker
// disappears (Setup finished), the guard switches itself off and the desktop is a normal desktop again.
//
// The Overview itself (Super key, hot corner, three-finger swipe) is NOT blocked any more: Beta 3.2.1
// on a Vivobook had a pointer that moved but clicked nothing, and a guard that took over the
// Overview and the touchpad gestures was the main suspect. The guard never takes input away from
// Setup: the cover does not react to the pointer, so clicks always reach the window below it.
//
// Active when:
//   /etc/xdg/autostart/shrimp-setup-install.desktop exists  -> live medium (install)
//   /var/lib/shrimp-setup/first-boot exists                  -> first configuration
// Off when a drive labelled SHRIMP_TEST is connected (QEMU tests in CI, support).
//
// Clicks must always reach Setup (Beta 3.2 on a Vivobook: the pointer moved, but no click, tap or
// mouse button did anything). The guard therefore never hides the Overview while GNOME is still
// running its startup animation (GNOME keeps an invisible, reactive layer over the whole screen
// until that animation ends), and a watchdog checks what is under the pointer in the middle of the
// Setup window: an invisible layer left there by the shell or by the guard is made click-through,
// and the result is logged (journalctl --user -b | grep shrimp-setup-guard).
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SETUP_ID = 'org.shrimp.Setup';
const LIVE_AUTOSTART = '/etc/xdg/autostart/shrimp-setup-install.desktop';
const FIRST_BOOT_MARKER = '/var/lib/shrimp-setup/first-boot';
const NOGUARD = '/dev/disk/by-label/SHRIMP_TEST';
// Keyboard layout switching stays available (the account and Wi-Fi password fields need it).
const ALLOWED_KEYBINDINGS = new Set(['switch-input-source', 'switch-input-source-backward', 'toggle-overview']);
// Setup gone (crash): start it again this many times, then give the desktop back
// so that nobody is locked out of the computer.
const MAX_RESTARTS = 3;
// Setup window expected this soon after login (autostart), after a crash, and after each restart.
const FIRST_WAIT_S = 45;
const RESTART_DELAY_S = 3;
const RETRY_WAIT_S = 30;
// Input watchdog: first check soon after Setup shows up, then every few seconds; GNOME's startup
// layer is forced click-through when the startup animation has not ended this long after enable.
const WATCH_EVERY_S = 3;
const STARTUP_STUCK_S = 15;

function log(msg) {
    console.log(`shrimp-setup-guard: ${msg}`);
}

function describe(actor) {
    if (!actor)
        return 'nothing';
    const name = actor.get_name?.() || '';
    return `${actor.constructor?.name ?? 'actor'}${name ? `#${name}` : ''}`;
}

function isInside(actor, ancestor) {
    for (let a = actor; a; a = a.get_parent())
        if (a === ancestor)
            return true;
    return false;
}

function exists(path) {
    return GLib.file_test(path, GLib.FileTest.EXISTS);
}

function guardMode() {
    if (exists(NOGUARD))
        return null;
    if (exists(LIVE_AUTOSTART))
        return 'install';
    if (exists(FIRST_BOOT_MARKER))
        return 'first-boot';
    return null;
}

function isSetup(win) {
    if (!win)
        return false;
    const ids = [win.get_gtk_application_id?.(), win.get_wm_class?.(), win.get_sandboxed_app_id?.()];
    if (ids.includes(SETUP_ID))
        return true;
    // Fallback: the Setup window (WebKitGTK) may report no app id yet; its title is "Shrimp".
    return win.get_title?.() === 'Shrimp' && /shrimp-setup/i.test(String(win.get_wm_class_instance?.() ?? win.get_wm_class?.() ?? ''));
}

export default class SetupGuardExtension extends Extension {
    enable() {
        this._mode = guardMode();
        if (!this._mode)
            return;
        this._signals = [];
        this._sources = new Set();
        this._restarts = 0;
        this._setup = null;
        this._enabledAt = GLib.get_monotonic_time();
        this._inputOk = null;
        log(`active (${this._mode}), shell starting up: ${Boolean(Main.layoutManager._startingUp)}`);
        this._lock();
        this._connect(global.display, 'window-created', (_d, win) => this._onWindow(win, false));
        for (const actor of global.get_window_actors())
            this._onWindow(actor.meta_window, true);
        if (!this._setup) {
            this._showCover();
            this._waitForSetup(FIRST_WAIT_S);
        }
        // The SHRIMP_TEST drive may show up a moment after login.
        for (const s of [5, 20, 60]) {
            this._timeout(s, () => {
                if (this._mode && exists(NOGUARD))
                    this._deactivate();
            });
        }
        // GNOME opens the Overview right after login (startup animation). Hiding it while that
        // animation runs can leave GNOME's invisible startup layer over the screen (no clicks), so
        // every hide (ours and Setup's, over D-Bus) waits for the end of the startup.
        if (Main.layoutManager._startingUp) {
            this._connect(Main.layoutManager, 'startup-complete', () => {
                log('shell startup complete');
                this._hideOverview();
            });
        } else {
            this._hideOverview();
        }
        this._watchInput();
    }

    disable() {
        if (!this._mode)
            return;
        this._deactivate();
    }

    _deactivate() {
        for (const id of this._sources)
            GLib.source_remove(id);
        this._sources.clear();
        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        this._signals = [];
        this._unlock();
        this._hideCover(false);
        this._setup = null;
        this._mode = null;
    }

    _connect(obj, signal, fn) {
        this._signals.push([obj, obj.connect(signal, fn)]);
    }

    _timeout(seconds, fn) {
        const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._sources.delete(id);
            fn();
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
    }

    // --- what is blocked ---

    _lock() {
        // Every shell and mutter shortcut (Alt+Tab, Super+A, Alt+F2, Super+number, …) except layout switching.
        // The shell's own filter runs first; returning true here stops the shortcut.
        this._connect(global.window_manager, 'filter-keybinding',
            (_wm, binding) => !ALLOWED_KEYBINDINGS.has(binding.get_name()));
        this._bannerBlocked = Main.messageTray.bannerBlocked;
        Main.messageTray.bannerBlocked = true;
    }

    _unlock() {
        if (this._bannerBlocked !== undefined)
            Main.messageTray.bannerBlocked = this._bannerBlocked;
        this._bannerBlocked = undefined;
    }

    // --- the Setup window ---

    _onWindow(win, existing) {
        if (!win || !this._mode)
            return;
        log(`window: class ${win.get_wm_class?.()}, app ${win.get_gtk_application_id?.()}, title ${win.get_title?.()}, setup ${isSetup(win)}`);
        if (isSetup(win)) {
            if (win.get_window_type() !== Meta.WindowType.NORMAL)
                return;
            this._setup = win;
            win.make_above();
            this._connect(win, 'unmanaged', () => this._onSetupGone(win));
            const actor = win.get_compositor_private();
            if (existing || !actor)
                this._hideCover(false);
            else
                this._connect(actor, 'first-frame', () => this._hideCover(true));
            return;
        }
        // Anything else that opens while Setup is on screen goes behind it.
        if (this._setup && win.get_window_type() === Meta.WindowType.NORMAL && win.get_transient_for() !== this._setup) {
            const setup = this._setup;
            this._timeout(0, () => {
                if (this._setup === setup)
                    setup.activate(global.get_current_time());
            });
        }
    }

    _onSetupGone(win) {
        if (this._setup !== win)
            return;
        this._setup = null;
        this._mode = guardMode();
        if (!this._mode) {
            // First configuration finished: normal desktop from now on.
            this._mode = 'done';
            this._deactivate();
            return;
        }
        this._showCover();
        this._waitForSetup(RESTART_DELAY_S);
    }

    // No Setup window after `seconds`: start Setup (again). After MAX_RESTARTS attempts the guard gives
    // the desktop back, so a broken Setup never leaves a black screen.
    _waitForSetup(seconds) {
        this._timeout(seconds, () => {
            if (this._setup || !this._mode)
                return;
            if (this._restarts >= MAX_RESTARTS) {
                console.warn('shrimp-setup-guard: Setup did not come up, giving the desktop back');
                this._deactivate();
                return;
            }
            this._restarts++;
            const arg = this._mode === 'install' ? '--install' : '--first-boot';
            try {
                GLib.spawn_async(null, ['/usr/bin/shrimp-setup', arg], null, GLib.SpawnFlags.DEFAULT, null);
            } catch (e) {
                console.error(`shrimp-setup-guard: ${e}`);
            }
            this._waitForSetup(RETRY_WAIT_S);
        });
    }

    _hideOverview() {
        if (Main.layoutManager._startingUp)
            return;
        Main.overview.hide();
    }

    // --- clicks reach Setup ---

    _watchInput() {
        this._timeout(WATCH_EVERY_S, () => {
            if (!this._mode)
                return;
            this._checkInput();
            this._watchInput();
        });
    }

    // What would get a click in the middle of the Setup window. Anything but the window itself is an
    // invisible layer swallowing clicks: GNOME's startup layer, our own cover, a leftover modal grab.
    _checkInput() {
        const lm = Main.layoutManager;
        const sinceS = (GLib.get_monotonic_time() - this._enabledAt) / 1e6;
        if (lm._startingUp && lm._coverPane?.reactive && sinceS > STARTUP_STUCK_S) {
            log(`shell startup still not complete after ${Math.round(sinceS)} s: its input layer made click-through`);
            lm._coverPane.reactive = false;
            lm._coverPane.hide();
            this._hideOverview();
        }
        const win = this._setup;
        const actor = win?.get_compositor_private();
        if (!win || !actor?.visible) {
            this._inputOk = null;
            return;
        }
        if (this._cover) {
            log('cover still on screen with Setup shown: removed');
            this._hideCover(false);
        }
        if (Main.overview.visible && !Main.overview.animationInProgress) {
            log('Overview open over Setup: hiding it');
            this._hideOverview();
        }
        const r = win.get_frame_rect();
        const [x, y] = [r.x + Math.floor(r.width / 2), r.y + Math.floor(r.height / 2)];
        const hit = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
        const ok = isInside(hit, actor);
        const grab = global.stage.get_grab_actor?.() ?? null;
        if (ok !== this._inputOk || !ok) {
            log(`input ${ok ? 'OK' : 'BLOCKED'}: at ${x},${y} ${describe(hit)}, grab ${describe(grab)}, ` +
                `modal ${Main.modalCount}, overview ${Main.overview.visible}, starting up ${Boolean(lm._startingUp)}`);
        }
        this._inputOk = ok;
        if (!ok && hit && !isInside(hit, global.window_group) && hit.opacity === 0 && hit.reactive) {
            // An invisible reactive layer of the shell over Setup: let clicks through.
            log(`${describe(hit)} is invisible but catches clicks: made click-through`);
            hit.reactive = false;
        }
    }

    // --- cover ---

    _showCover() {
        if (this._cover)
            return;
        const cover = new St.Widget({
            reactive: false,
            style: 'background-color: #000000;',
            layout_manager: new Clutter.BinLayout(),
        });
        cover.add_child(new St.Icon({
            icon_name: 'shrimp-logo-symbolic',
            icon_size: 96,
            style: 'color: rgba(255, 255, 255, 0.92);',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        }));
        cover.add_constraint(new Clutter.BindConstraint({source: global.stage, coordinate: Clutter.BindCoordinate.ALL}));
        Main.layoutManager.addTopChrome(cover);
        this._cover = cover;
    }

    _hideCover(animate) {
        const cover = this._cover;
        if (!cover)
            return;
        this._cover = null;
        // Click-through from the first moment: the fade must never swallow clicks meant for Setup.
        cover.reactive = false;
        const done = () => {
            Main.layoutManager.removeChrome(cover);
            cover.destroy();
        };
        if (!animate) {
            done();
            return;
        }
        cover.ease({opacity: 0, duration: 250, mode: Clutter.AnimationMode.EASE_OUT_QUAD, onComplete: done});
    }
}
