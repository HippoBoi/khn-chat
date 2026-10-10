import api from './api';

export interface AndroidVersionInfo {
  latestVersionCode: number;
  latestVersionName: string;
  downloadUrl: string;
  message: string;
}

export interface AppVersionResponse {
  android: AndroidVersionInfo;
}

export async function fetchAndroidVersionInfo(): Promise<AndroidVersionInfo | null> {
  try {
    const response = await api.get<AppVersionResponse>('/app-version');
    const android = response.data?.android;
    if (!android || !Number.isFinite(Number(android.latestVersionCode))) {
      return null;
    }
    return {
      latestVersionCode: Number(android.latestVersionCode),
      latestVersionName: String(android.latestVersionName || ''),
      downloadUrl: String(android.downloadUrl),
      message: String(android.message || ''),
    };
  } catch {
    return null;
  }
}

export function isVersionOutdated(currentBuild: number | null, latestVersionCode: number): boolean {
  if (currentBuild === null || !Number.isFinite(currentBuild)) return false;
  if (!Number.isFinite(latestVersionCode)) return false;
  return currentBuild < latestVersionCode;
}
