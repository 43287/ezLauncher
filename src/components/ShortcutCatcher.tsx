import React, { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

interface ShortcutCatcherProps {
    value: string;
    onChange: (value: string) => void;
    defaultValue?: string;
}

export const ShortcutCatcher: React.FC<ShortcutCatcherProps> = ({ value, onChange, defaultValue }) => {
    const [recording, setRecording] = useState(false);
    const [tempValue, setTempValue] = useState('');
    const [resetting, setResetting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const setIsRecordingShortcut = useAppStore(state => state.setIsRecordingShortcut);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!recording) return;
        
        e.preventDefault();
        e.stopPropagation();

        const key = e.key;
        
        // 取消录制
        if (key === 'Escape') {
            setRecording(false);
            setIsRecordingShortcut(false);
            setTempValue('');
            inputRef.current?.blur();
            return;
        }

        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Super');

        const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(key);
        
        if (!isModifier) {
            let primaryKey = key;
            if (primaryKey === ' ') {
                primaryKey = 'Space';
            } else if (primaryKey.length === 1) {
                primaryKey = primaryKey.toUpperCase();
            }

            const combo = [...modifiers, primaryKey].join('+');
            onChange(combo);
            setRecording(false);
            setIsRecordingShortcut(false);
            setTempValue('');
            inputRef.current?.blur();
        } else {
            // 仅按下了修饰键时，实时显示
            setTempValue(modifiers.join('+') + '+');
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();
        
        const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key);
        if (isModifier) {
            // 如果释放了修饰键，并且没有按下主键，则重置显示
            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.metaKey) modifiers.push('Super');
            
            if (modifiers.length > 0) {
                setTempValue(modifiers.join('+') + '+');
            } else {
                setTempValue('');
            }
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!recording) return;
        
        // e.button: 3 is Mouse4 (Back), 4 is Mouse5 (Forward)
        if (e.button === 3 || e.button === 4) {
            e.preventDefault();
            e.stopPropagation();
            
            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.metaKey) modifiers.push('Super');
            
            const buttonName = e.button === 3 ? 'Mouse4' : 'Mouse5';
            const combo = [...modifiers, buttonName].join('+');
            
            onChange(combo);
            setRecording(false);
            setIsRecordingShortcut(false);
            setTempValue('');
            inputRef.current?.blur();
        }
    };

    const displayValue = resetting ? '已重置' : (recording ? (tempValue || '请按下快捷键...') : (value || '无'));

    return (
        <input
            ref={inputRef}
            type="text"
            readOnly
            className={`w-32 bg-black/5 dark:bg-white/5 border ${
                resetting
                    ? 'border-green-400 ring-1 ring-green-400 text-green-500'
                    : recording 
                        ? 'border-blue-400 ring-1 ring-blue-400 text-blue-500' 
                        : 'border-transparent hover:border-black/10 dark:hover:border-white/20 text-gray-900 dark:text-gray-100'
            } rounded-md px-2 py-1 text-sm focus:outline-none transition-colors cursor-pointer text-center select-none`}
            value={displayValue}
            onClick={() => {
                setRecording(true);
                setIsRecordingShortcut(true);
                setTempValue('');
            }}
            onBlur={() => {
                if (tempValue && !tempValue.endsWith('+')) {
                    onChange(tempValue);
                }
                setRecording(false);
                setIsRecordingShortcut(false);
                setTempValue('');
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onPointerDown={handlePointerDown}
            onContextMenu={(e) => {
                e.preventDefault();
                if (defaultValue !== undefined) {
                    onChange(defaultValue);
                    setResetting(true);
                    setTimeout(() => {
                        setResetting(false);
                    }, 800);
                }
            }}
            title="点击以录制快捷键，按 Esc 取消"
        />
    );
};
