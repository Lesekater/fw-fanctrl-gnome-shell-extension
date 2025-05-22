# Fan Control Extension for Framework Laptop
> [!CAUTION]
> **THIS IS A ROUGH BACKPORT TO GNOME 42 to support PopOS 22 \
> Might have bugs that the "newer" version doesnt have**

Gnome Shell extension to manage fw-fanctrl - Framework Laptop Fan Control

## Requisites
You need to have [fw-fanctrl](https://github.com/TamtamHero/fw-fanctrl) installed.

## Manual Installation
If you want to install this extension manually:

1. Create a folder named `fw-fanctrl` in:

  `~/.local/share/gnome-shell/extensions/`

  It should look like this:

  `~/.local/share/gnome-shell/extensions/fw-fanctrl/`

2. Now copy the content of `src/` into the folder.
3. Restart your gnome-shell session and you should see the icon on the taskbar.

### Policy Kit

Given how `ectool` [works](https://www.reddit.com/r/framework/comments/yelsj2/fan_speed_reporting_in_linux/), we need sudo permissions to gather fan speed.

In order to see the fan speed, you will need to grant admin permissions to the extension to use ectool.

Copy the file in `actions/org.gnome.shell.extensions.fw-fanctrl.policy` into `/usr/share/polkit-1/actions/`.


Note: This extension is not affiliated, funded, or in any way associated with Framework Computer.
