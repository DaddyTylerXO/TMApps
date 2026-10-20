# Third-party components

TMA-Cut runs Electron (MIT) and launches FFmpeg and FFprobe as separate processes. Electron's packaged license files are included by electron-builder. Media-tool packages and notices are retained under resources/app.asar.unpacked/node_modules.

- [Electron license](https://github.com/electron/electron/blob/main/LICENSE)
- [ffmpeg-static 5.3.0](https://github.com/eugeneware/ffmpeg-static) (GPL-3.0-or-later); binary release b6.1.1 and build/source information: [upstream release](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1).
- [FFmpeg source](https://ffmpeg.org/download.html) and [licensing information](https://ffmpeg.org/legal.html).
- [ffprobe-static](https://github.com/joshwnj/ffprobe-static) supplies FFprobe. Refer to included notices and upstream FFmpeg licensing for its binary build.

Export filters follow the [official filter documentation](https://ffmpeg.org/ffmpeg-filters.html). HDR processing uses Hable tone mapping into BT.709 SDR. Downstream redistributors must retain applicable licenses and source obligations.
