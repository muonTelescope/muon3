# Documentation Images, Data & Additional Information — Google Drive

This project pulls simulation data, test results, additional documentation, photos, renders, and diagrams from Google Drive for the LaTeX paper, Vision Pro app, reports, and sims.

**"Connectors" available:**
- **Google Drive API v3** (our script + rclone): for files, folders with sim outputs, CAD, PDFs, additional data, images.
- Desktop: Google Drive for desktop (not currently installed/synced on this Mac for any accounts — see check below).
- CLI: rclone (best for multiple accounts), gdrive CLI.
- Python: google-api-python-client (not installed by default; see requirements).

No active Google Drive desktop sync or mounted "My Drive" for accounts was found on this system (only Chrome related Google data in Library). Use API/CLI connectors instead.

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

For custom folders or combining with other pulls, update the scripts or ask.

## Combining with build workflows
- Add `rclone` or the Python pull commands to your local workflow before running sims or building docs.
- Never commit secrets or large raw downloads.

