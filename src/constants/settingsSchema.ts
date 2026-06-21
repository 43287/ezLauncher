// 设置项 schema 的集中定义（从 SettingsWindow 组件外移，FR-016）

import { SettingSchema } from '../types';

export const SETTINGS_SCHEMA: SettingSchema[] = [
  {
    id: 'summonShortcut',
    category: '快捷键管理',
    label: '键盘呼出',
    description: '全局键盘快捷键，用于快速唤醒 ezLaunch 面板',
    type: 'shortcut',
    defaultValue: 'Alt+Space',
  },
  {
    id: 'summonMouseShortcut',
    category: '快捷键管理',
    label: '鼠标呼出',
    description: '全局鼠标快捷键，用于快速唤醒 ezLaunch 面板',
    type: 'shortcut',
    defaultValue: 'Mouse4',
  },
  {
    id: 'autoStart',
    category: '通用',
    label: '开机自启',
    description: '随系统启动时自动运行',
    type: 'switch',
    defaultValue: false,
  },
  {
    id: 'dockPosition',
    category: '通用',
    label: '侧边停靠',
    description: '选择主窗口贴靠在屏幕的哪一边',
    type: 'select',
    options: [
      { label: '靠右', value: 'right' },
      { label: '靠左', value: 'left' },
    ],
    defaultValue: 'right',
  },
  {
    id: 'theme',
    category: '外观',
    label: '主题模式',
    description: '选择应用外观',
    type: 'select',
    options: [
      { label: '跟随系统', value: 'system' },
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'dark' },
    ],
    defaultValue: 'system',
  },
  {
    id: 'columns',
    category: '外观',
    label: '网格列数',
    description: '主界面应用列表的列数 (1-12)',
    type: 'input',
    defaultValue: '4',
  }
];
