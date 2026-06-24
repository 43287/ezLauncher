import { useModalStore } from "../store/useModalStore";
import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { SettingsWindow } from "./SettingsWindow";
import { PropertiesModal } from "./PropertiesModal";
import { SystemAppModal } from "./SystemAppModal";
import { LaunchItem } from "../types";
import { generateId } from "../constants/ids";

export function AppModals() {
  const {
    isSettingsOpen,
    closeSettings,
    editingApp,
    closeEditApp,
    isAddingApp,
    addingAppType,
    closeAddApp,
    isSystemAppOpen,
    closeSystemApp,
  } = useModalStore();

  const updateApp = useDataStore((state) => state.updateApp);
  const addApp = useDataStore((state) => state.addApp);
  const activeLeftTab = useUIStore((state) => state.activeLeftTab);
  const activeTopTab = useUIStore((state) => state.activeTopTab);

  return (
    <>
      {isSettingsOpen && <SettingsWindow onClose={closeSettings} />}

      {isSystemAppOpen && <SystemAppModal onClose={closeSystemApp} />}

      {editingApp && (
        <PropertiesModal
          app={editingApp}
          onClose={closeEditApp}
          onSave={(updatedApp) => {
            updateApp(updatedApp.id, updatedApp);
            closeEditApp();
          }}
        />
      )}

      {isAddingApp && (
        <PropertiesModal
          app={{
            id: generateId(),
            name: "新建快捷方式",
            type: addingAppType,
            shortcut: null,
            categoryId: activeLeftTab,
            columnId: activeTopTab,
          } as LaunchItem}
          onClose={closeAddApp}
          onSave={(newApp) => {
            addApp(newApp);
            closeAddApp();
          }}
        />
      )}
    </>
  );
}
