import React, { useState, useRef, useEffect } from 'react';

interface ContextMenuItemProps {
  label: string | React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
}

export const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ label, onClick, children, className = "" }) => {
  const [intentRight, setIntentRight] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isSubmenuHovered, setIsSubmenuHovered] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSubmenu = React.Children.count(children) > 0;

  const handleButtonMouseMove = (e: React.MouseEvent) => {
    if (!hasSubmenu) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    // Smooth out detection to prevent jitter
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      // 如果向右移动的水平距离大于垂直距离的 1.2 倍，且具有一定的速度，则判断为有向右进入子菜单的意图
      if (dx > 0.5 && dx > Math.abs(dy) * 1.2) {
        setIntentRight(true);
      } else if (dx < -0.5 || Math.abs(dy) > Math.abs(dx) * 2) {
        // 如果向左移动，或者垂直移动远大于水平移动（向下/向上滚动菜单），取消意图
        if (!isSubmenuHovered) {
          setIntentRight(false);
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
    
    // Determine exit direction
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const isExitingRight = e.clientX >= buttonRect.right - 5;
    
    // 延迟关闭，允许鼠标在跨越空白间隙时保持子菜单打开和收缩状态
    // 如果向右侧离开（进入子菜单），给予较长延迟。如果是向其他方向离开，则快速重置
    timeoutRef.current = setTimeout(() => {
      if (!isSubmenuHovered) {
        setIntentRight(false);
      }
    }, isExitingRight ? 300 : 50);
  };

  const handleSubmenuMouseEnter = () => {
    setIsSubmenuHovered(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleSubmenuMouseLeave = (e: React.MouseEvent) => {
    setIsSubmenuHovered(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Calculate if mouse is moving back towards the parent item
    const buttonRect = (e.currentTarget.previousElementSibling as HTMLElement)?.getBoundingClientRect();
    const isMovingTowardsParent = buttonRect && e.clientX < buttonRect.right;
    
    timeoutRef.current = setTimeout(() => {
      // Clear intent
      if (!isButtonHovered) {
        setIntentRight(false);
      }
    }, isMovingTowardsParent ? 50 : 300); // Faster reset if moving back to parent
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
        className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 focus-visible:outline-none relative z-50 ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="relative w-full h-[28px]">
      {/* 视觉层：在有向右意图或者鼠标在子菜单内部时，保持收缩为 60% 宽度，否则占满 100% */}
      <button 
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onClick) onClick(e);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseMove={handleButtonMouseMove}
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={handleButtonMouseLeave}
        className={`absolute left-0 top-0 h-full flex justify-between items-center px-3 text-xs font-medium transition-all duration-300 ease-out focus-visible:outline-none overflow-hidden whitespace-nowrap
          ${showSubmenu ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md' : 'text-gray-700 dark:text-gray-200'}
          ${isContracted ? 'w-[60%]' : 'w-full'}
          ${className}
        `}
      >
        <span className="truncate">{label}</span>
        {/* 箭头在收缩时淡出并向右略微偏移隐藏 */}
        <span className={`text-[10px] text-gray-400 transition-all duration-300 ${isContracted ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}>▶</span>
      </button>

      {/* 子菜单层：根据收缩状态调整左侧起点，实现同步向左滑动的动画 */}
      <div 
        className={`absolute -top-1.5 w-24 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-1.5 overflow-visible transition-all duration-300 ease-out origin-left z-10
          ${showSubmenu ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2 pointer-events-none'}
          ${isContracted ? 'left-[60%]' : 'left-full'}
        `}
        onMouseEnter={handleSubmenuMouseEnter}
        onMouseLeave={handleSubmenuMouseLeave}
      >
        {children}
      </div>
    </div>
  );
};
