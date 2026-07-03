import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import type { ReleaseInfo } from '../types/ReleaseInfo';
import { isNewerVersion } from '../utils/versionCheck';
import { useToastStore } from '../store/useToastStore';

// GitHub 仓库坐标（git remote: 43287/ezLauncher）
export const UPDATE_OWNER = '43287';
export const UPDATE_REPO = 'ezLauncher';

// 执行一次真实的 release 检查：有新版则 toast 提示，其它情况静默
// 返回值仅供调用方决定是否做后续反馈（toast 已在此函数内弹出）
export async function checkAndNotifyUpdate(): Promise<{ checked: boolean; hasNewer: boolean }> {
    try {
        const [release, localVersion] = await Promise.all([
            invoke<ReleaseInfo | null>('check_latest_release', {
                owner: UPDATE_OWNER,
                repo: UPDATE_REPO,
            }),
            getVersion(),
        ]);

        if (!release) return { checked: true, hasNewer: false };
        if (!isNewerVersion(release.tagName, localVersion)) {
            return { checked: true, hasNewer: false };
        }

        const tagName = release.tagName;
        const { addToast } = useToastStore.getState();
        addToast(`发现新版本 ${tagName}`, 'info', {
            label: '前往下载',
            onClick: () => {
                invoke('open_release_url', { url: release.htmlUrl }).catch(() => {});
            },
        });
        return { checked: true, hasNewer: true };
    } catch {
        // 静默失败：版本检查不应以错误形式打扰用户
        return { checked: false, hasNewer: false };
    }
}

// 仅在应用启动时检查一次新版本；网络/限速/解析失败一律静默，绝不打扰用户
export function useUpdateChecker(enabled: boolean) {
    const checkedRef = useRef(false);

    useEffect(() => {
        if (!enabled || checkedRef.current) return;
        checkedRef.current = true;

        // 延迟 5s 执行，避免与启动初始化抢资源
        const timer = setTimeout(() => {
            void checkAndNotifyUpdate();
        }, 5000);

        return () => clearTimeout(timer);
    }, [enabled]);
}
