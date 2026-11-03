# Hash Commander (Centro de Comando)

🇵🇹 [Versão em português](README.md)

A monitoring and control dashboard for home Bitcoin miners: NerdQAxe++, Bitaxe and other AxeOS devices,
plus cgminer-based machines. It runs on your own computer, talks to your miners on your local network
and opens in the browser. Available in English, Portuguese, Spanish and French.

## Download

Get the latest version from the [Releases page](https://github.com/bladept696/centro-de-comando-v3/releases/latest):

| System | File | Notes |
|---|---|---|
| Windows 10/11 | `CentroDeComando-Setup-X.exe` | Normal installer. |
| macOS (Apple Silicon: M1/M2/M3/M4) | `CentroDeComando-X-mac-arm64.zip` | Unzip and move the app to *Applications*. |
| macOS (Intel) | `CentroDeComando-X-mac-x64.zip` | Same as above. |
| Linux (x86_64) | `CentroDeComando-X-linux-x86_64.AppImage` | `chmod +x` the file, then run it. |

**macOS:** the app is not signed by Apple. The first time, right-click the app and choose **Open**, then
confirm. If macOS says the app is "damaged", run this once in the Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/CentroDeComando.app"
```

**Linux:** the tray icon needs a desktop with AppIndicator support (GNOME needs the
*AppIndicator* extension). Without it the dashboard still works normally.

Updates are automatic on every system. Each update file is signed (Ed25519) and the app refuses
anything whose signature does not match.

## Main features

- **Machine cards:** hashrate with trend, temperature, fan, Wi-Fi, power, efficiency, shares, pool,
  1/6/24 h history, grouping, favourites, notes, filters, bulk Eco/Turbo/restart, comparison and CSV export.
- **Alerts:** temperature, rejects, Wi-Fi, slow pool, hashrate drops and stuck machines (with optional
  automatic restart or smart-plug power cycle). Alerts are sent by Telegram, Discord, desktop notifications,
  browser, webhook or ntfy, and can be spoken aloud.
- **Best shares and blocks:** best-share history, live difficulty, block detection and a signed block certificate.
- **Pools:** stats for Public Pool, Solo CK, Parasite, Molepool, DeFi Surfers and others, with
  a "Hashrate & Difficulty" chart. Pool block notifications say who found the block.
- **Honest pool check:** reads the block template your pool sends (the coinbase) and shows where the
  reward would actually go: to you, split between miners, or somewhere else. It warns you if that changes.
- **Hashrate market (peer-to-peer):** rent out your AxeOS machines, or rent someone else's, with no
  middleman. Offers travel over Nostr and payments are made over Lightning, from each user's own wallet
  (Nostr Wallet Connect). Payment is per short period and stops as soon as the hashrate stops arriving.
  The buyer can point the machines at any public pool.
- **Physical screen (ESP32):** turns a LilyGO T-Display-S3 into a small live display for your farm.
  Install it from the dashboard with a USB cable (no tools needed). It keeps working with the PC turned off.
- **Energy profiles (MQTT / Home Assistant):** suggests frequency and voltage profiles based on solar
  production and electricity price. Profiles are always applied manually.
- **Extras:** network map, 3D charts, reactive background, mini floating window, community chat,
  profitability and costs, printable reports, backup and restore.

## Running from source

```bash
pip install -r requirements.txt
python app.py
```

This starts a local server on port 8765 and opens the dashboard in your browser.

## Building

- **Windows:** `python -m PyInstaller --noconfirm CentroDeComando.spec`, then compile
  `CentroDeComando.iss` with Inno Setup.
- **macOS / Linux:** `./build_unix.sh` (or the *Build Mac e Linux* workflow on GitHub Actions).
- **ESP32 screen firmware:** `python build_screen_fw.py` (needs PlatformIO).

## Privacy

Your settings, keys and wallet connection stay on your computer, in the app's data folder. They are never
included in the repository or in the installers: `verificar_release.py` checks this before every release.

## License

© 2026 bladept696. All rights reserved. See the notice at the top of each file.
