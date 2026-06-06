import React, { useState, useRef, useEffect } from 'react';

interface ContextMenuItemProps {
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
  isSeparator?: boolean;
}

export const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ 
  label, 
  onClick, 
  children, 
  className = "", 
  isSeparator 
}) => {
  const [intentRight, setIntentRight] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isSubmenuHovered, setIsSubmenuHovered] = useState(false);
  const [submenuDirection, setSubmenuDirection] = useState<'right' | 'left'>('right');
  const lastMousePos = useRef({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  if (isSeparator) {
    return <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-2" />;
  }

  const hasSubmenu = React.Children.count(children) > 0;

  useEffect(() => {
    if ((isButtonHovered || isSubmenuHovered || intentRight) && itemRef.current && hasSubmenu) {
      const rect = itemRef.current.getBoundingClientRect();
      const menuParent = itemRef.current.closest('.fixed.z-50');
      const parentWidth = menuParent ? menuParent.getBoundingClientRect().width : 120;
      
      if (rect.right + parentWidth + 20 > window.innerWidth) {
        setSubmenuDirection('left');
      } else {
        setSubmenuDirection('right');
      }
    }
  }, [isButtonHovered, isSubmenuHovered, intentRight, hasSubmenu]);

  const handleButtonMouseMove = (e: React.MouseEvent) => {
    if (!hasSubmenu) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      if (submenuDirection === 'right') {
        if (dx > 0.5 && dx > Math.abs(dy) * 1.2) {
          setIntentRight(true);
        } else if (dx < -0.5 || Math.abs(dy) > Math.abs(dx) * 2) {
          if (!isSubmenuHovered) setIntentRight(false);
        }
      } else {
        if (dx < -0.5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          setIntentRight(true);
        } else if (dx > 0.5 || Math.abs(dy) > Math.abs(dx) * 2) {
          if (!isSubmenuHovered) setIntentRight(false);
        }
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleButtonMouseEnter = (e: React.MouseEvent) => {
    setIsButtonHovered(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleButtonMouseLeave = (e: React.MouseEvent) => {
    setIsButtonHovered(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const isExitingTowardsSubmenu = submenuDirection === 'right' 
      ? e.clientX >= buttonRect.right - 5 
      : e.clientX <= buttonRect.left + 5;
    
    timeoutRef.current = setTimeout(() => {
      if (!isSubmenuHovered) {
        setIntentRight(false);
      }
    }, isExitingTowardsSubmenu ? 300 : 50);
  };

  const handleSubmenuMouseEnter = () => {
    setIsSubmenuHovered(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleSubmenuMouseLeave = (e: React.MouseEvent) => {
    setIsSubmenuHovered(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const buttonRect = (e.currentTarget.previousElementSibling as HTMLElement)?.getBoundingClientRect();
    const isMovingTowardsParent = buttonRect && (submenuDirection === 'right' 
      ? e.clientX < buttonRect.right 
      : e.clientX > buttonRect.left);
    
    timeoutRef.current = setTimeout(() => {
      if (!isButtonHovered) {
        setIntentRight(false);
      }
    }, isMovingTowardsParent ? 50 : 300);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isContracted = intentRight || isSubmenuHovered;
  const showSubmenu = isButtonHovered || isSubmenuHovered || intentRight;

  if (!hasSubmenu) {
    return (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) onClick(e);
        }}
        className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 focus-visible:outline-none relative z-50 whitespace-nowrap ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div ref={itemRef} className="relative w-full h-[28px] z-[60]">
      <button 
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onClick) onClick(e);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseMove={handleButtonMouseMove}
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={handleButtonMouseLeave}
        className={`absolute top-0 h-full flex justify-between items-center px-3 text-xs font-medium transition-all duration-300 apple-ease focus-visible:outline-none overflow-hidden whitespace-nowrap
          ${showSubmenu ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-md' : 'text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10'}
          ${submenuDirection === 'right' ? 'left-0' : 'right-0'}
          ${isContracted ? 'w-[60%]' : 'w-full'}
          ${className}
        `}
      >
        {submenuDirection === 'left' && (
          <span className={`text-[10px] text-gray-400 transition-all duration-300 mr-2 ${isContracted ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'}`}>◀</span>
        )}
        <span className="truncate">{label}</span>
        {submenuDirection === 'right' && (
          <span className={`text-[10px] text-gray-400 transition-all duration-300 ml-2 ${isContracted ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}>▶</span>
        )}
      </button>

      {/* 子菜单层 */}
      <div 
        className={`absolute -top-1.5 min-w-max w-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-soft-lg border border-black/5 dark:border-white/10 py-1.5 overflow-visible transition-all duration-300 apple-ease z-[70]
          ${showSubmenu ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}
          ${submenuDirection === 'right' 
            ? `origin-left ${showSubmenu ? 'translate-x-0' : '-translate-x-2'} ${isContracted ? 'left-[60%]' : 'left-full'}`
            : `origin-right ${showSubmenu ? 'translate-x-0' : 'translate-x-2'} ${isContracted ? 'right-[60%]' : 'right-full'}`
          }
        `}
        onMouseEnter={handleSubmenuMouseEnter}
        onMouseLeave={handleSubmenuMouseLeave}
      >
        <div className="flex flex-col min-w-full">
          {children}
        </div>
      </div>
    </div>
  );
};
