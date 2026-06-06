import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { JsonValue } from "../types";

export function useStoreSync(
  updateSetting: (key: string, value: JsonValue) => void,
  hasInitialized: boolean
) {
  useEffect(() => {
    if (!hasInitialized) return;

    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.apps !== prevState.apps) {
        updateSetting("apps", state.apps as unknown as JsonValue);
      }
      if (state.leftTabs !== prevState.leftTabs) {
        updateSetting("leftTabs", state.leftTabs as unknown as JsonValue);
      }
      if (state.topTabs !== prevState.topTabs) {
        updateSetting("topTabs", state.topTabs as unknown as JsonValue);
      }
    });

    return () => unsubscribe();
  }, [hasInitialized, updateSetting]);
}
