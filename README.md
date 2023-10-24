# Krita Export - Substance 3D Painter plugin

This plugin adds an __Export To Krita__ button to the Send To menu of Substance Painter. The export action creates one Krita document for each channel of each stack of the Substance Painter document, preserving the stack hierarchy (layers and groups). Blend modes and filters are preserved to the best of the programs possibility.

## Installation

Download or clone this project into the Substance Painter plugins folder. The plugins folder can be opened from Substance Painter through the menu ``Plugins/Plugins folder``. Substance Painter needs to be restarted for the plugin to take effect. Once installed, make sure you go into the configure page for the plugin and set the path to kritarunner.exe, which can be found at `C:\Program Files\Krita (x64)\bin` on Windows
