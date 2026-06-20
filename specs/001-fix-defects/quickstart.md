# Quickstart & Validation Guide: fix-defects

## Prerequisites
- Windows 10/11 environment
- Node.js 18+ and Rust toolchain installed

## Validation Scenarios

### 1. Validate LPE Security Fix (Admin Proxy)
1. Build and run the app: `npm run tauri dev`
2. Create a shortcut to an app (e.g., `cmd.exe`) and set it to run as Admin.
3. Launch it. Ensure the UAC prompt appears and the app launches successfully.
4. **Verification**: Check the terminal logs. The `proxy_server.rs` should log the PID verification. Attempting to manually pipe to `ezlauncher_main_proxy_*.sock` from another script should be ignored/rejected.

### 2. Validate App.tsx Decoupling & Drag-and-Drop
1. Open the application.
2. Drag and drop multiple app icons to reorder them in the grid.
3. **Verification**: The reordering should be visually smooth. Check the React Developer Tools / Console. There should be **NO** duplicate key warnings (UUID fix) and **NO** warnings about mutated synthetic events.

### 3. Validate Shell-Words Argument Parsing
1. Add a new shortcut with the target: `cmd.exe`
2. Set the arguments to: `/k echo "Hello World"`
3. Launch the shortcut.
4. **Verification**: The opened command prompt should accurately print `Hello World` without quotes being mangled.

### 4. Validate Grid Layout & Responsive Design
1. Add enough shortcuts to fill the grid.
2. Resize the application window horizontally.
3. **Verification**: The grid items must wrap cleanly using `repeat(auto-fill, ...)` without icon or text overlapping.
