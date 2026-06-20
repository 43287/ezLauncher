# Quickstart Validation Guide

This guide provides steps to manually validate the fixes for the core defects without diving into the source code.

## 1. Validate `.lnk` Admin Launch
**Goal**: Ensure shortcuts can be launched with elevated privileges.
1. Create a shortcut (`.lnk`) to an application (e.g., `notepad.exe`) on your desktop.
2. Drag and drop the `.lnk` file into the ezLaunch grid.
3. Right-click the newly added icon and select **"以管理员启动" (Run as Administrator)**.
4. Accept the UAC prompt.
5. **Expected Outcome**: The target application (Notepad) launches successfully. (Previously, this would silently fail or log OS Error 193).

## 2. Validate Graceful Proxy Shutdown
**Goal**: Ensure no zombie threads remain after the app closes.
1. Launch `ezLaunch`.
2. Open Windows Task Manager and navigate to the Details tab. Find `ezLaunch.exe`.
3. Close the `ezLaunch` application normally.
4. **Expected Outcome**: The `ezLaunch.exe` process disappears entirely within 1-2 seconds. No lingering proxy listener threads keep the process alive in the background.

## 3. Validate Async I/O Error Handling
**Goal**: Ensure disk write failures are reported to the user.
1. Navigate to the data folder where `settings.json` is stored (either `%APPDATA%\ezLaunch` or the `data` folder in portable mode).
2. Right-click `settings.json` -> Properties -> Check **"Read-only"**.
3. Open `ezLaunch` and modify a setting (e.g., toggle "Run at startup" or change grid columns).
4. **Expected Outcome**: A Toast Notification (or similar UI alert) appears stating that the settings could not be saved (e.g., "IO_ERROR").

## 4. Validate Memory Safety (UB Fix)
**Goal**: Ensure DPAPI encryption works without crashing under strict aliasing.
1. Add a new application to the grid (this triggers a save, which encrypts `apps.json`).
2. Restart the application.
3. **Expected Outcome**: The grid loads correctly, proving that the encryption and decryption processes in `crypto_service.rs` functioned properly after the safety refactor.