import { TauriAdapter } from './TauriAdapter';
import { IPlatform } from './IPlatform';

export * from './IPlatform';
export * from './TauriAdapter';

// Singleton instance of the platform adapter
export const platform: IPlatform = new TauriAdapter();
