# Quickstart Validation Guide

This guide details how to verify the decoupling refactoring was successful without breaking existing functionality.

## 1. Verify Application Launch
**Goal**: Ensure `ShortcutItem.tsx` still launches applications correctly after logic extraction.
1. Start the application.
2. Click on a standard `.exe` shortcut.
3. Verify the application launches successfully.
4. Verify the ezLaunch window hides immediately upon clicking (if configured).

## 2. Verify Macro Replacement
**Goal**: Ensure drag-and-drop or context-based macros (`{target_path}`, etc.) still function correctly.
1. Create a shortcut that uses a macro, e.g., an editor configured to open `{target_file}`.
2. Drag a text file onto this shortcut.
3. Verify the editor opens with the correct file loaded.

## 3. Verify Admin Launch Routing
**Goal**: Ensure the "Run as Administrator" logic was properly extracted.
1. Right-click a shortcut and select "以管理员启动" (Run as Administrator).
2. Verify the UAC prompt appears and the application launches with elevated privileges.

## 4. Code Structure Verification
**Goal**: Ensure the coupling has been reduced.
1. Open `src/components/ShortcutItem.tsx`.
2. Search for `tauriApi` imports or usages. There should be none (or they should be replaced by a generic platform adapter import if DI isn't fully implemented).
3. Search for `buildLaunchContext` or shell routing logic (e.g., `cmd /C start`). This logic should now reside in `src/services/LaunchService.ts`.