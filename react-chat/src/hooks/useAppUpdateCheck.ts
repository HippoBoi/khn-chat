import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { isNativePlatform } from '../services/platform';
import { fetchAndroidVersionInfo, isVersionOutdated, type AndroidVersionInfo } from '../services/appUpdate';

const DISMISS_KEY_PREFIX = 'khn-update-dismissed-';

export interface AppUpdateState {
  isOutdated: boolean;
  currentVersionName: string | null;
  latest: AndroidVersionInfo | null;
  dismiss: () => void;
}

function getDismissKey(versionCode: number): string {
  return `${DISMISS_KEY_PREFIX}${versionCode}`;
}

export function useAppUpdateCheck(): AppUpdateState {
  const [latest, setLatest] = useState<AndroidVersionInfo | null>(null);
  const [currentBuild, setCurrentBuild] = useState<number | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;

    (async () => {
      try {
        const info = await App.getInfo();
        if (cancelled) return;
        const build = Number(info.build);

        setCurrentBuild(Number.isFinite(build) ? build : null);
        setCurrentVersionName(info.version ?? null);
      } catch {
        if (!cancelled) {
          setCurrentBuild(null);
          setCurrentVersionName(null);
        }

        return;
      }

      const remote = await fetchAndroidVersionInfo();
      if (cancelled || !remote) return;
      setLatest(remote);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const outdated =
    !dismissed && latest !== null && isVersionOutdated(currentBuild, latest.latestVersionCode);

  const dismiss = () => {
    if (latest) {
      try {
        window.localStorage.setItem(getDismissKey(latest.latestVersionCode), String(Date.now()));
      } catch {
        // catch
      }
    }
    setDismissed(true);
  };

  return {
    isOutdated: outdated,
    currentVersionName,
    latest: outdated ? latest : null,
    dismiss,
  };
}
