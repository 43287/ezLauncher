# Quickstart & Validation Guide: frontend-decoupling

## Prerequisites
- Windows 10/11 environment
- Node.js 18+ and Rust toolchain installed

## Validation Scenarios

### 1. Validate Store Decoupling (P1 Bug Fix)
1. Run the app: `npm run tauri dev`
2. Click on different categories in the left `Sidebar`.
3. **Verification**: The `AppGrid` should instantly update to show apps belonging to the selected category. The `TopBar` tabs should update to match the active category.

### 2. Validate App.tsx Decoupling & Drag-and-Drop
1. Open the application.
2. Drag and drop an app icon within the grid.
3. Right-click on an empty space in the grid.
4. **Verification**: The drag-and-drop animation should be smooth. The global context menu should appear with options like "添加可执行程序" (Add Executable). The `App.tsx` file should be much smaller and cleaner.

### 3. Validate A11y Add Buttons
1. Hover over the left `Sidebar` area.
2. **Verification**: An "Add Category" (or "+") button should appear. Clicking it should allow creating a new category.
3. Check the `TopBar`.
4. **Verification**: There should be no "Add Tab" button if there are already 4 tabs.
