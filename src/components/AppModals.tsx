import { useModalStore } from '../store/useModalStore';
import { useAppStore } from '../store/useAppStore';
import { SettingsWindow } from './SettingsWindow';
import { PropertiesModal } from './PropertiesModal';

export function AppModals() {
  const { 
    isSettingsOpen, closeSettings,
    editingApp, closeEditApp,
    isAddingApp, addingAppType, closeAddApp
  } = useModalStore();

  const { updateApp, addApp, activeLeftTab, activeTopTab } = useAppStore();

  return (
    <>
      {isSettingsOpen && (
        <SettingsWindow onClose={closeSettings} />
      )}

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
            id: Date.now().toString(), 
            name: "新建快捷方式", 
            type: addingAppType, 
            shortcut: null,
            categoryId: activeLeftTab,
            columnId: activeTopTab
          }}
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
