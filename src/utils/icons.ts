import DOMPurify from 'dompurify';

export const SVG_ICONS: Record<string, string> = {
  python: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 2 8 5.5 8 5.5V8H16V9.5H8C5.5 9.5 5.5 13.5 5.5 13.5C5.5 17.5 8 17.5 8 17.5H9.5V15.5C9.5 14.1 10.6 13 12 13H15.5C16.9 13 18 11.9 18 10.5V6.5C18 2.5 12 2 12 2ZM10.5 4C11.05 4 11.5 4.45 11.5 5C11.5 5.55 11.05 6 10.5 6C9.95 6 9.5 5.55 9.5 5C9.5 4.45 9.95 4 10.5 4ZM12 22C16 22 16 18.5 16 18.5V16H8V14.5H16C18.5 14.5 18.5 10.5 18.5 10.5C18.5 6.5 16 6.5 16 6.5H14.5V8.5C14.5 9.9 13.4 11 12 11H8.5C7.1 11 6 12.1 6 13.5V17.5C6 21.5 12 22 12 22ZM13.5 20C12.95 20 12.5 19.55 12.5 19C12.5 18.45 12.95 18 13.5 18C14.05 18 14.5 18.45 14.5 19C14.5 19.55 14.05 20 13.5 20Z" fill="#3776AB"/></svg>`,
  javascript: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#F7DF1E"/><path d="M12.3 18.2C11.3 19 10 19.4 8.7 19.4C7 19.4 5.5 18.8 4.4 17.6L6.2 15.6C6.8 16.3 7.6 16.8 8.6 16.8C9.5 16.8 10 16.4 10 15.8C10 14.6 4.7 14.8 4.7 11C4.7 9.1 6.1 7.7 8.5 7.7C9.9 7.7 11 8.2 11.9 9.1L10.2 11.1C9.6 10.4 8.9 10.1 8.3 10.1C7.5 10.1 7.1 10.5 7.1 11C7.1 12.1 12.5 11.9 12.5 15.8C12.5 16.8 12.5 17.6 12.3 18.2ZM20.7 18.2C19.7 19 18.4 19.4 17.1 19.4C14.9 19.4 13.4 18.2 12.7 16.5L15.1 15.4C15.5 16.4 16.2 17.1 17.3 17.1C18.1 17.1 18.6 16.7 18.6 16.1C18.6 15 13.5 15 13.5 11.1C13.5 9.1 14.9 7.7 17.2 7.7C18.7 7.7 19.8 8.3 20.6 9.4L18.8 11C18.3 10.3 17.7 10 17 10C16.3 10 15.9 10.4 15.9 10.9C15.9 12.1 21.1 11.8 21.1 15.8C21.1 16.8 21.1 17.6 20.7 18.2Z" fill="black"/></svg>`,
  batch: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#4D4D4D"/><path d="M4 6L10 12L4 18H7L13 12L7 6H4ZM12 16H20V18H12V16Z" fill="white"/></svg>`,
  powershell: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#012456"/><path d="M4 6L11 12L4 18H7L14 12L7 6H4ZM12 16H20V18H12V16Z" fill="white"/></svg>`,
  bash: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#4EAA25"/><path d="M5 5L12 11.5L5 18H8.5L15.5 11.5L8.5 5H5ZM13 16.5H19V18.5H13V16.5Z" fill="white"/></svg>`,
  lua: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#000080"/><circle cx="16" cy="7" r="2.5" fill="white"/><circle cx="17.5" cy="16" r="1.5" fill="white"/><circle cx="7" cy="15" r="3" fill="white"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="#808080"/></svg>`,
  dir_fallback_icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 3.89543 4.89543 3 6 3H8.70711C9.2375 3 9.74618 3.21071 10.1213 3.58579L11.4142 4.87868C11.7893 5.25376 12.298 5.46447 12.8284 5.46447H18C19.1046 5.46447 20 6.3599 20 7.46447V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5Z" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>`
};

// SVG 净化：用 DOMPurify（SVG profile）取代易漏的正则，禁止 foreignObject/use/style/script
// 与事件属性、javascript: 协议（FR-011 / contracts/svg-sanitize.md）。
// 渲染只发生在浏览器；测试/node 无 DOM 时直接返回原值（不参与渲染）。
function sanitizeSvg(markup: string): string {
    if (typeof window === 'undefined') return markup;
    return DOMPurify.sanitize(markup, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['foreignObject', 'use', 'style', 'script', 'a'],
        FORBID_ATTR: ['href', 'xlink:href'],
    });
}

export const resolveIcon = (iconStr: string | null | undefined): { type: 'svg' | 'url' | 'lucide', content: string } | null => {
  if (!iconStr) return null;

  const trimmed = iconStr.trim();
  
  if (trimmed.startsWith('lucide://')) {
    return { type: 'lucide', content: trimmed.replace('lucide://', '') };
  }

  if (SVG_ICONS[trimmed]) {
    return { type: 'svg', content: SVG_ICONS[trimmed] };
  }

  if (trimmed.startsWith('<svg')) {
    return { type: 'svg', content: sanitizeSvg(trimmed) };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return { type: 'url', content: trimmed };
  }

  if (trimmed.startsWith('ezicon://')) {
    const pathPart = trimmed.substring('ezicon://'.length);
    return { type: 'url', content: `http://ezicon.localhost/${pathPart}` };
  }

  // Treat as local path, use ezicon protocol
  // 使用 hex 编码替代已弃用的 escape() 函数
  const encodedPath = encodeURIComponent(trimmed.replace(/\\/g, '/'))
    .replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/\*/g, '%2A');
  return { type: 'url', content: `http://ezicon.localhost/${encodedPath}` };
};

export const getIconForExtension = (ext: string): string | null => {
  switch (ext.toLowerCase()) {
    case 'py':
    case 'pyw':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'bat':
    case 'cmd':
      return 'batch';
    case 'ps1':
      return 'powershell';
    case 'sh':
      return 'bash';
    case 'lua':
      return 'lua';
    case 'txt':
    case 'md':
    case 'json':
    case 'xml':
    case 'csv':
    case 'log':
    case 'ini':
      return 'text';
    default:
      return null;
  }
};

export const getInterpreterForExtension = (ext: string): string | null => {
  switch (ext.toLowerCase()) {
    case 'py':
    case 'pyw':
      return 'python.exe';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'node.exe';
    case 'bat':
    case 'cmd':
      return 'cmd.exe';
    case 'ps1':
      return 'powershell.exe';
    case 'sh':
      return 'bash.exe';
    case 'lua':
      return 'lua.exe';
    default:
      return null;
  }
};
