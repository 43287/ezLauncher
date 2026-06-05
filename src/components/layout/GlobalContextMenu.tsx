import React, { useEffect, useRef } from 'react';
import { useContextMenuStore, ContextMenuItemData } from '../../store/useContextMenuStore';
import { ContextMenuItem } from '../ContextMenuItem';

export const GlobalContextMenu: React.FC = () => {
  const { isOpen, position, items, closeMenu } = useContextMenuStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('blur', closeMenu);
      // Optional: Prevent context menu inside context menu to be safe
      const handleContextMenu = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          closeMenu();
        }
      };
      window.addEventListener('contextmenu', handleContextMenu);
      
      return () => {
        window.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('blur', closeMenu);
        window.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [isOpen, closeMenu]);

  if (!isOpen) return null;

  const renderItems = (items: ContextMenuItemData[]) => {
    return items.map((item, index) => {
      if (item.isSeparator) {
        return <ContextMenuItem key={`sep-${index}`} isSeparator />;
      }
      
      if (item.children && item.children.length > 0) {
        return (
          <ContextMenuItem 
            key={`${item.label}-${index}`} 
            label={item.label}
          >
            {renderItems(item.children)}
          </ContextMenuItem>
        );
      }
      
      return (
        <ContextMenuItem 
          key={`${item.label}-${index}`} 
          label={item.label} 
          onClick={(e) => {
            if (item.onClick) item.onClick(e);
            closeMenu();
          }} 
        />
      );
    });
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] min-w-max w-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-1.5"
      style={{ 
        left: position.x, 
        top: position.y 
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col w-full">
        {renderItems(items)}
      </div>
    </div>
  );
};
