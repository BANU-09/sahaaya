'use client';
import { api, ClientError } from './client';
export async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator))
    throw new ClientError('serviceUnavailable', 503);
  const config = await api<{
    apiKey?: string;
    projectId?: string;
    appId?: string;
    messagingSenderId?: string;
    vapidKey?: string;
    webPushPublicKey?: string;
  }>('push');
  if (!config.webPushPublicKey && (!config.apiKey || !config.projectId || !config.vapidKey))
    throw new ClientError('notConfigured', 503);
  if ((await Notification.requestPermission()) !== 'granted')
    throw new ClientError('permissionRequired', 403);
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if (config.webPushPublicKey) {
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: config.webPushPublicKey,
      }));
    await api('push', 'POST', { subscription: subscription.toJSON() });
    await api('settings', 'PATCH', { push: true });
    return;
  }
  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/messaging'),
  ]);
  if (!(await isSupported())) throw new ClientError('serviceUnavailable', 503);
  const app = getApps()[0] || initializeApp(config);
  const token = await getToken(getMessaging(app), {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });
  await api('push', 'POST', { token });
  await api('settings', 'PATCH', { push: true });
}
