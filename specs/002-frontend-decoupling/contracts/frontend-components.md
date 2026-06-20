# Interface Contract: Frontend Components

## 1. `DragDropProvider` Props

```typescript
import { ReactNode } from 'react';

interface DragDropProviderProps {
  children: ReactNode;
}

export const DragDropProvider: React.FC<DragDropProviderProps>;
```

## 2. `useGlobalContextMenu` Hook

```typescript
import React from 'react';

interface GlobalContextMenuHandlers {
  handleContextMenu: (e: React.MouseEvent) => void;
}

export function useGlobalContextMenu(): GlobalContextMenuHandlers;
```
