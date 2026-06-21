import { describe, it, expect } from 'vitest';
import { getInterpreterForExtension } from '../icons';

describe('getInterpreterForExtension', () => {
  it('maps script extensions to interpreters', () => {
    expect(getInterpreterForExtension('py')).toBe('python.exe');
    expect(getInterpreterForExtension('pyw')).toBe('python.exe');
    expect(getInterpreterForExtension('js')).toBe('node.exe');
    expect(getInterpreterForExtension('bat')).toBe('cmd.exe');
    expect(getInterpreterForExtension('cmd')).toBe('cmd.exe');
    expect(getInterpreterForExtension('ps1')).toBe('powershell.exe');
    expect(getInterpreterForExtension('sh')).toBe('bash.exe');
    expect(getInterpreterForExtension('lua')).toBe('lua.exe');
  });

  it('is case-insensitive', () => {
    expect(getInterpreterForExtension('PY')).toBe('python.exe');
  });

  it('returns null for unknown extensions', () => {
    expect(getInterpreterForExtension('exe')).toBeNull();
    expect(getInterpreterForExtension('')).toBeNull();
  });
});
