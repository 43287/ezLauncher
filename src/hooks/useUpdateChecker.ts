import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import type { ReleaseInfo } from '../types/ReleaseInfo';
import { isNewerVersion } from '../utils/versionCheck';
import { useToastStore } from '../store/useToastStore';

// GitHub 仓库坐标（git remote: 43287/ezLauncher）
const OWNER = '43287';
const REPO = 'ezLauncher';

// 仅在应用启动时检查一次新版本；网络/限速/解析失败一律静默，绝不打扰用户
export function useUpdateChecker(enabled: boolean) {
    const addToast = useToastStore((s) => s.addToast);
    const checkedRef = useRef(false);

    useEffect(() => {
        if (!enabled || checkedRef.current) return;
        checkedRef.current = true;

        // 延迟 5s 执行，避免与启动初始化抢资源
        const timer = setTimeout(async () => {
            try {
                const [release, localVersion] = await Promise.all([
                    invoke<ReleaseInfo | null>('check_latest_release', { owner: OWNER, repo: REPO }),
                    getVersion(),
                ]);

                if (!release) return;
                if (!isNewerVersion(release.tagName, localVersion)) return;

                const tagName = release.tagName;
                addToast(`发现新版本 ${tagName}`, 'info', {
                    label: '前往下载',
                    onClick: () => {
                        invoke('open_release_url', { url: release.htmlUrl }).catch(() => {});
                    },
                });
            } catch {
                // 静默失败：版本检查不应以错误形式打扰用户
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [enabled, addToast]);
}
