// Shrimp Menu: the Shrimp logo on the left of the top bar opens the system menu
// (about this computer, settings, software and updates, system tools, sleep, restart,
// power off, lock, log out). Texts: lang/_keys.tsv + lang/<tag>.txt (same format as i18n/).
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const decoder = new TextDecoder();

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes) : null;
    } catch {
        return null;
    }
}

function parseTsv(text, cols) {
    const out = [];
    for (const line of (text ?? '').split(/\r?\n/)) {
        if (!line || line.startsWith('#'))
            continue;
        const parts = line.split('\t');
        if (parts.length >= cols)
            out.push(parts);
    }
    return out;
}

// Texts for the session language: pl_PL.UTF-8 -> pl-pl, pl; pt_BR -> pt-br, pt. English fallback.
function loadStrings(dir) {
    const strings = {};
    const byId = {};
    for (const [id, key, en] of parseTsv(readText(`${dir}/lang/_keys.tsv`), 3)) {
        strings[key] = en;
        byId[id] = key;
    }
    const tags = [];
    for (const name of GLib.get_language_names()) {
        if (name === 'C' || name === 'POSIX')
            continue;
        const tag = name.replace(/\..*$/, '').replace(/@.*$/, '').replace(/_/g, '-').toLowerCase();
        if (!tags.includes(tag))
            tags.push(tag);
    }
    for (const tag of tags) {
        const text = readText(`${dir}/lang/${tag}.txt`);
        if (text === null)
            continue;
        for (const [id, value] of parseTsv(text, 2)) {
            if (byId[id])
                strings[byId[id]] = value;
        }
        break;
    }
    return strings;
}

function findApp(ids) {
    const appSystem = Shell.AppSystem.get_default();
    for (const id of ids) {
        const app = appSystem.lookup_app(id);
        if (app)
            return app;
    }
    return null;
}

function spawn(argv) {
    try {
        GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
    } catch (e) {
        console.error(`Shrimp Menu: ${argv.join(' ')}: ${e.message}`);
    }
}

const ShrimpMenuButton = GObject.registerClass(
class ShrimpMenuButton extends PanelMenu.Button {
    _init(dir) {
        super._init(0.0, 'Shrimp', false);
        this._t = loadStrings(dir);
        this.add_style_class_name('shrimp-menu-button');
        this.accessible_name = this._t['menu.tooltip'];

        this.add_child(new St.Icon({
            gicon: Gio.ThemedIcon.new_with_default_fallbacks('shrimp-logo-symbolic'),
            style_class: 'system-status-icon shrimp-menu-icon',
        }));

        // Applications can be installed or removed while the session runs.
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._build();
        });
        this._build();
    }

    _item(key, callback) {
        const item = new PopupMenu.PopupMenuItem(this._t[key]);
        item.connect('activate', () => {
            this.menu.close();
            callback();
        });
        this.menu.addMenuItem(item);
        return item;
    }

    _appItem(key, ids) {
        const app = findApp(ids);
        if (app)
            this._item(key, () => app.activate());
        return app;
    }

    _separator() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _build() {
        this.menu.removeAll();

        this._item('menu.about', () => spawn(['gnome-control-center', 'system', 'about']));
        this._appItem('menu.settings', ['org.gnome.Settings.desktop', 'gnome-control-center.desktop']);
        this._separator();

        // Shrimp Apps is the store; updates are on its "Installed" page, so the same window opens.
        const software = this._appItem('menu.software', ['org.shrimp.Apps.desktop']);
        if (software)
            this._item('menu.updates', () => software.activate());
        this._appItem('menu.monitor', ['org.gnome.SystemMonitor.desktop', 'gnome-system-monitor.desktop']);
        this._appItem('menu.disks', ['org.gnome.DiskUtility.desktop', 'gnome-disks.desktop']);
        this._appItem('menu.terminal', ['org.gnome.Console.desktop', 'org.gnome.Terminal.desktop']);
        this._appItem('menu.extensions', ['org.gnome.Extensions.desktop', 'com.mattjakeman.ExtensionManager.desktop']);
        this._separator();

        this._item('menu.suspend', () => spawn(['systemctl', 'suspend']));
        this._item('menu.restart', () => spawn(['gnome-session-quit', '--reboot']));
        this._item('menu.poweroff', () => spawn(['gnome-session-quit', '--power-off']));
        this._separator();

        this._item('menu.lock', () => spawn(['loginctl', 'lock-session']));
        this._item('menu.logout', () => spawn(['gnome-session-quit', '--logout']));
    }
});

export default class ShrimpMenuExtension extends Extension {
    enable() {
        this._button = new ShrimpMenuButton(this.path);
        // Index 0 on the left: before Apps Menu ("Programy"); Activities is hidden by Just Perfection.
        Main.panel.addToStatusArea(this.uuid, this._button, 0, 'left');
    }

    disable() {
        this._button?.destroy();
        this._button = null;
    }
}
