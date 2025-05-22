const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

function init() {
    // Für GNOME Shell 42 benötigt, kann leer bleiben
}

function buildPrefsWidget() {
    let settings = ExtensionUtils.getSettings();
    let refreshSeconds = settings.get_int('refresh-seconds');

    let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12/*, border_width: 12 */});

    let label = new Gtk.Label({ label: _('Configure the time elapsed between speed checks.'), xalign: 0 });
    vbox.append ? vbox.append(label) : vbox.pack_start(label, false, false, 0);

    let adjustment = new Gtk.Adjustment({
        value: refreshSeconds,
        lower: 1,
        upper: 600,
        step_increment: 1,
    });
    let spin = new Gtk.SpinButton({ adjustment: adjustment });
    spin.set_value(refreshSeconds);
    spin.connect('value-changed', function(widget) {
        let newVal = widget.get_value_as_int();
        if (newVal !== settings.get_int('refresh-seconds'))
            settings.set_int('refresh-seconds', newVal);
    });
    vbox.append ? vbox.append(spin) : vbox.pack_start(spin, false, false, 0);

    return vbox;
}
