importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCP0OhN79PZ6rdCRnTlAUR2bJHFeLI6fu0',
  authDomain: 'khn-chat-b8853.firebaseapp.com',
  projectId: 'khn-chat-b8853',
  messagingSenderId: '719105479821',
  appId: '1:719105479821:web:de219905ea00ba60afbec4',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'KHN Chat';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.svg',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
