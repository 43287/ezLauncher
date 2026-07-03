// 版本号比对：判断 GitHub release tag 是否比本地版本新

// 将 "v0.2.0-beta" / "0.2.0" 归一化为 [major, minor, patch] 数字数组
// 解析失败的字段按 0 处理
function parseSemver(version: string): [number, number, number] {
    const cleaned = version.trim().replace(/^v/i, '').split('-')[0].split('+')[0];
    const parts = cleaned.split('.');
    const major = parseInt(parts[0] ?? '0', 10) || 0;
    const minor = parseInt(parts[1] ?? '0', 10) || 0;
    const patch = parseInt(parts[2] ?? '0', 10) || 0;
    return [major, minor, patch];
}

// 返回 true 表示 remote 严格大于 local
export function isNewerVersion(remote: string, local: string): boolean {
    const [rMajor, rMinor, rPatch] = parseSemver(remote);
    const [lMajor, lMinor, lPatch] = parseSemver(local);

    if (rMajor !== lMajor) return rMajor > lMajor;
    if (rMinor !== lMinor) return rMinor > lMinor;
    return rPatch > lPatch;
}
