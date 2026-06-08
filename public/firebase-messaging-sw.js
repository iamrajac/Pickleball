// Firebase Messaging Service Worker — handles background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB1itlBl7vdO5JSRTlUifMHZn09fj8LyMI",
  authDomain: "pickleball-srm.firebaseapp.com",
  projectId: "pickleball-srm",
  storageBucket: "pickleball-srm.firebasestorage.app",
  messagingSenderId: "1056007468517",
  appId: "1:1056007468517:web:98cb1f355cc0036f3e6b0c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Pickleball';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'pkl',
    data: payload.data || {},
  });
});
