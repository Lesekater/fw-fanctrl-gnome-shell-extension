/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;

// GNOME 42: Keine Extension-Klasse, stattdessen globale Variablen und enable/disable/init
let _indicator = null;
let _settings = null;
let _sourceId = null;
let currentMode = null;
let foundCommand = true;
let fanSpeed = 0;
let refreshSeconds = 5;

const MODES = [
    {
        mode: 'laziest',
        name: 'Super Quiet',
        icon: 'network-cellular-signal-none-symbolic',
    },
    {
        mode: 'lazy',
        name: 'Quiet',
        icon: 'network-cellular-signal-weak-symbolic',
    },
    {
        mode: 'medium',
        name: 'Normal',
        icon: 'network-cellular-signal-ok-symbolic',
    },
    {
        mode: 'agile',
        name: 'Somewhat noisy',
        icon: 'network-cellular-signal-good-symbolic',
    },
    {
        mode: 'very-agile',
        name: 'Very Agile',
        icon: 'network-cellular-signal-excellent-symbolic',
    },
    {
        mode: 'deaf',
        name: 'Super Fan',
        icon: 'network-cellular-acquiring-symbolic',
    },
    {
        mode: 'aeolus',
        name: 'Take Off',
        icon: 'weather-windy-symbolic',
    },
];

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('fw-fanctrl'));

            this.icon = new St.Icon({
                icon_name: 'network-cellular-connected-symbolic',
                style_class: 'system-status-icon',
            });

            this.add_child(this.icon);
        }
    });

function execCommand(argv, input = null, cancellable = null) {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE;

    if (input !== null)
        flags |= Gio.SubprocessFlags.STDIN_PIPE;

    const proc = new Gio.Subprocess({
        argv,
        flags,
    });
    proc.init(cancellable);

    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(input, cancellable, (procReceived, res) => {
            try {
                resolve(procReceived.communicate_utf8_finish(res)[1]);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function init() {
    // Keine Initialisierung nötig
}

function enable() {
    currentMode = null;
    foundCommand = true;
    fanSpeed = 0;

    _indicator = new Indicator();
    Main.panel.addToStatusArea(Me.metadata.uuid, _indicator);

    // Settings laden
    _settings = ExtensionUtils.getSettings();
    refreshSeconds = _settings.get_int('refresh-seconds');

    log(`Refresh Seconds: ${refreshSeconds}`);

    async function checkFanSpeed() {
        try {
            let fanSpeedResult = await execCommand(['pkexec', 'ectool', 'pwmgetfanrpm']);
            fanSpeedResult = fanSpeedResult.slice(0, -1);
            fanSpeedResult = fanSpeedResult.split(' ');
            return fanSpeedResult[3];
        } catch (e) {
            logError(e);
        }
        return false;
    }

    function setFan(modeString) {
        try {
            Gio.Subprocess.new(['fw-fanctrl', modeString], Gio.SubprocessFlags.NONE);
        } catch (e) {
            logError(e);
        }
    }

    function iconChange() {
        if (!foundCommand) {
            logError('fw-fanctrl is not installed');
            sendNotification('Fan Speed not working', "You don't have fw-fanctrl installed!");
            _indicator.icon.icon_name = 'software-update-urgent-symbolic';
            return false;
        }

        if (currentMode)
            _indicator.icon.icon_name = currentMode.icon;

        return true;
    }

    function sendNotification(title, content) {
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);
        let notification = new MessageTray.Notification(source, title, content);
        notification.setTransient(true);
        source.notify(notification);
    }

    function resetMenuItems(menuItems) {
        for (let i = 0; i < menuItems.length; i++) {
            menuItems[i].setOrnament && menuItems[i].setOrnament(PopupMenu.Ornament.NONE);
        }
    }

    function updateFanSpeed() {
        if (_indicator.menu && _indicator.menu._getMenuItems().length > 0) {
            let firstItem = _indicator.menu._getMenuItems()[0];
            if (firstItem && firstItem.label)
                firstItem.label.text = `Speed: ${fanSpeed} rpm.`;
        }
    }

    function setMenu() {
        _indicator.menu.removeAll();

        let fanSpeedItem = new PopupMenu.PopupMenuItem('loading...');
        fanSpeedItem.setSensitive(false);
        _indicator.menu.addMenuItem(fanSpeedItem);

        let menuSeparator = new PopupMenu.PopupSeparatorMenuItem();
        _indicator.menu.addMenuItem(menuSeparator);

        for (let i = 0; i < MODES.length; i++) {
            let item = new PopupMenu.PopupMenuItem(_(`${MODES[i].name}`));
            if (currentMode && MODES[i].mode === currentMode.mode) {
                item.setOrnament && item.setOrnament(PopupMenu.Ornament.DOT);
            }
            item.connect('activate', () => {
                setFan(MODES[i].mode);
                currentMode = MODES[i];
                iconChange();
                setMenu();
            });
            _indicator.menu.addMenuItem(item);
        }

        // Open Settings
        let openSettings = new PopupMenu.PopupMenuItem(_('Settings'));
        openSettings.connect('activate', () => {
            ExtensionUtils.openPrefs();
        });
        _indicator.menu.addMenuItem(openSettings);
    }

    async function getFan() {
        try {
            let fanResult = await execCommand(['fw-fanctrl', '-q']);
            fanResult = fanResult.slice(0, -1);
            for (let i = 0; i < MODES.length; i++) {
                if (MODES[i].mode === fanResult) {
                    currentMode = MODES[i];
                    break;
                }
            }
        } catch (e) {
            foundCommand = false;
            logError(e);
        }
    }

    function configChange() {
        let newRefreshSeconds = _settings.get_int('refresh-seconds');
        if (newRefreshSeconds !== refreshSeconds) {
            refreshSeconds = newRefreshSeconds;
            startLoop();
        }
    }

    function startLoop() {
        stopLoop();
        _sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, refreshSeconds, () => {
            checkFanSpeed().then(speed => {
                fanSpeed = speed;
                updateFanSpeed();
            });
            configChange();
            return GLib.SOURCE_CONTINUE;
        });
    }

    setMenu();
    getFan();
    startLoop();
}

function stopLoop() {
    if (_sourceId) {
        GLib.Source.remove(_sourceId);
        _sourceId = null;
    }
}

function disable() {
    stopLoop();
    _settings = null;
    if (_indicator) {
        _indicator.destroy();
        _indicator = null;
    }
}
