# Documentation Images, Data & Additional Information — Google Photos + Google Drive

This project pulls photos, renders, simulation data, test results, and additional information from Google Photos and Google Drive for documentation, the LaTeX paper, Vision Pro app, reports, and sims.

**"Connectors" available:**
- **Google Photos Library API** (used by our script and gphotos-sync): for images/tests/data shots.
- **Google Drive API v3** (our script + rclone): for files, folders with sim outputs, CAD, PDFs, additional data.
- Desktop: Google Drive for desktop (not currently installed/synced on this Mac for any accounts — see check below).
- CLI: rclone (best for multiple accounts), gdrive CLI.
- Python: google-api-python-client (not installed by default; see requirements).

No active Google Drive desktop sync or mounted "My Drive" for accounts was found on this system (only Chrome related Google data in Library). Use API/CLI connectors instead.

## Google Photos for images, data, and tests (enhanced)

### To look through the photo library for data and tests
Use the enhanced script:

```bash
cd scripts
python pull_google_photos.py --list-albums                    # see all albums across accounts
python pull_google_photos.py --list-only --keywords "data,test,panel,oscilloscope,hit,simulation" --since 2025-01-01
python pull_google_photos.py --album "Tests,Data,Hardware" --keywords "data,test" --dest ../figures/tests
```

New features (all of the above +):
- `--since` / `--until` date filtering.
- `--keywords` for data/tests filtering (filename/desc).
- `--list-albums` and `--list-only` to explore without download.
- Multiple albums with comma list.
- Integrated with `./build_paper.sh --pull-images`

See script for full options. Supports multiple Google accounts via separate client_secret / token (run per account or use rclone).

## Recommended Way: gphotos-sync (Easiest)

The simplest and most reliable way to pull images is with the dedicated open-source tool `gphotos-sync`.

### One-time setup

1. Install the tool:
   ```bash
   pip install gphotos-sync
   ```

2. (Optional but recommended) Create a dedicated shared album in Google Photos called **"Muon3 Documentation"** (or any name you like). Upload your hardware photos, simulation screenshots, test setups, etc. into it. Share it with collaborators if needed.

3. Run the first sync (it will open a browser for you to authorize with your Google account):
   ```bash
   gphotos-sync --album "Muon3 Documentation" ./docs-images
   ```

   This will download the images into a local folder.

### Using the images

- Copy or symlink the files you need into `figures/`, `Muon3Vision/Resources/`, or wherever the paper/scripts expect them.
- For the LaTeX paper, place key images in `figures/` and reference them normally with `\includegraphics`.
- Commit only the specific images you need (or use Git LFS for large files). Do **not** commit the entire `docs-images` dump.

You can also run `./build_paper.sh --pull-images` from the project root — it will automatically pull from the Google Photos album before building the paper.

### Regular use

```bash
# Pull latest images from the album
gphotos-sync --album "Muon3 Documentation" ./docs-images

# Or sync everything (slower)
gphotos-sync ~/GooglePhotosBackup
```

See the [gphotos-sync documentation](https://github.com/gilesknap/gphotos-sync) for advanced options (date filters, size limits, etc.).

## Alternative: Custom Python Script (Google Photos Library API)

If you prefer not to use a third-party tool, you can use the official Google Photos Library API directly.

### Setup steps

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable the **"Photos Library API"**.
4. Go to **APIs & Services → Credentials**:
   - Configure the OAuth consent screen (choose "External" if needed and add your email as a test user).
   - Create credentials → **OAuth client ID** → Application type: **Desktop app**.
   - Download the `client_secret_....json` file.
5. Place the downloaded file in this project as `scripts/client_secret.json` (add it to `.gitignore` — never commit secrets).

### Running the helper script

See `pull_google_photos.py` in this directory.

Example:
```bash
cd scripts
python pull_google_photos.py --album "Muon3 Documentation" --dest ../figures/google
```

The script will open a browser on first run for authorization and then download images.

**Note:** The Google Photos Library API has some limitations:
- You must use a real user account (OAuth), not a service account.
- Download links are time-limited.
- For fully automated CI, `gphotos-sync` with a refresh token is easier.

## Tips for this project

- Keep a consistent naming convention in the album (e.g. `paper-fig-01-xxx.png`, `hardware-panel-front.jpg`).
- For the Vision Pro app, you can manually export a few key images into `Muon3Vision/Resources/`.
- Large raw photos can stay in Google Photos; only downsampled or cropped versions need to live in the repo.
- Update `figures/` and paper images manually after syncing so the Git history stays clean.

## Security

- Never commit `client_secret.json`, tokens, or refresh tokens.
- The `.gitignore` in this repo already ignores common credential files.

If you need help setting up a specific album name or integrating the pull step into `build_paper.sh`, just ask!

## Google Drive for Simulations and Additional Information

Use for pulling sim outputs (Geant4 results, ngspice waves, Python plots, CSV data, hits files), additional docs, CAD, papers, test results, etc.

### Quick start with our connector
```bash
cd scripts
python pull_google_drive.py --list-folders                    # explore folders across account
python pull_google_drive.py --folder "Muon3/Simulations" --dest ../sim/data/drive
python pull_google_drive.py --query "name contains 'test' or name contains 'data'" --dest ../additional
# For a second account:
python pull_google_drive.py --token-file drive_work.json --client-secret client_secret_work.json ...
```

Supports "all the accounts" by using different token/secret files per Google account (OAuth per account).

### Recommended for power users / multiple accounts: rclone (now installed)
```bash
rclone config          # add remotes e.g. gdrive-personal, gdrive-work (supports team drives)
rclone copy gdrive-personal:Muon3/Simulations ./sim/data/drive --progress
rclone copy gdrive-work:Muon3/Additional ./additional --include "*.pdf" --include "*.csv"
rclone ls gdrive-personal:Muon3/   # look through
```

rclone is excellent, scriptable, and handles many accounts/remotes easily. Can (and should) be used in build scripts, CI, etc.

### Local findings (as of latest check)
- No Google Drive desktop app or sync folders (~/Google Drive*, Drive for desktop) visible on this Mac.
- rclone is now available system-wide.
- No prior rclone/gdrive CLI configs found for user accounts.
- No Drive API credentials in common locations or keychain.
- Python Drive libs can be installed via `python3 -m pip install --break-system-packages google-api-python-client google-auth-oauthlib`.
- Old reference in project docs pointed to a Drive folder for diagrams (private, likely stale from earlier iterations).
- Use the scripts or rclone for pulling sims/additional data.

For custom folders, date filters, or combining Photos+Drive pulls, update the scripts or ask.

## Combining with build workflows
- `./build_paper.sh --pull-images` (Photos focused, can be extended).
- Add `rclone` or the Python pull commands to your local workflow before running sims or building docs.
- Never commit secrets or large raw downloads.

