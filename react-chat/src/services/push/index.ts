import { isNativePlatform } from '../platform';
import { nativePushService } from './NativePushService';
import type { PushService } from './types';
import { webPushService } from './WebPushService';

let resolvedPushService: PushService | null = null;

export function getPushService(): PushService {
  if (!resolvedPushService) {
    resolvedPushService = isNativePlatform() ? nativePushService : webPushService;
  }
  return resolvedPushService;
}