import { describe, it, expect } from 'vitest';
import { inferInterpreter, deriveNameFromPath, normalizeAppForSave, PropertiesFormData } from '../appTransform';
import { LaunchItem } from '../../types';

describe('inferInterpreter', () => {
  it('infers interpreter from script path', () => {
    expect(inferInterpreter('C:/scripts/run.py')).toBe('python.exe');
    expect(inferInterpreter('D:\\a\\b\\tool.ps1')).toBe('powershell.exe');
    expect(inferInterpreter('x.js')).toBe('node.exe');
  });

  it('returns null for paths without a known extension', () => {
    expect(inferInterpreter('C:/no/extension')).toBeNull();
    expect(inferInterpreter('app.exe')).toBeNull();
  });
});

describe('deriveNameFromPath', () => {
  it('strips directory and extension', () => {
    expect(deriveNameFromPath('C:/scripts/my_tool.py')).toBe('my_tool');
    expect(deriveNameFromPath('D:\\a\\Backup.cmd')).toBe('Backup');
  });
});

const baseApp = (type: string): LaunchItem => ({
  id: '1', name: 'old', type,
  url: null, executablePath: null, args: null, cwd: null, envVariables: null,
  runAsAdmin: null, inTerminal: null, isDir: null, iconUrl: null, shortcut: null,
  inputPipeline: null, paramPresets: null, multiParamEnabled: null,
  categoryId: '1', columnId: '1',
});

const form = (over: Partial<PropertiesFormData>): PropertiesFormData => ({
  name: 'n', shortcut: '', iconUrl: '', cwd: '', envVariables: '', runAsAdmin: false,
  executablePath: '', url: '', args: '', scriptPath: '', executorPath: '',
  commandText: '', shell: 'pwsh', inTerminal: false, ...over,
});

describe('normalizeAppForSave', () => {
  it('script: maps executor/scriptPath and defaults cwd to {target_path}', () => {
    const out = normalizeAppForSave(baseApp('script'), form({ executorPath: 'python.exe', scriptPath: 's.py' }));
    expect(out.executablePath).toBe('python.exe');
    expect(out.args).toBe('s.py');
    expect(out.cwd).toBe('{target_path}');
  });

  it('command: maps shell/commandText and inTerminal', () => {
    const out = normalizeAppForSave(baseApp('command'), form({ shell: 'cmd', commandText: 'echo hi', inTerminal: true }));
    expect(out.executablePath).toBe('cmd');
    expect(out.args).toBe('echo hi');
    expect(out.inTerminal).toBe(true);
  });

  it('app: maps executablePath/url/args', () => {
    const out = normalizeAppForSave(baseApp('app'), form({ executablePath: 'a.exe', url: '', args: '--x' }));
    expect(out.executablePath).toBe('a.exe');
    expect(out.args).toBe('--x');
  });

  it('empty shortcut becomes null', () => {
    const out = normalizeAppForSave(baseApp('app'), form({ shortcut: '' }));
    expect(out.shortcut).toBeNull();
  });
});
