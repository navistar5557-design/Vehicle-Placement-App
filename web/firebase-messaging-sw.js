importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA0AlvGWpiLa9D1aVbPEMuPcnI1M-DmCR4",
  authDomain: "cube-vehicle-placement.firebaseapp.com",
  projectId: "cube-vehicle-placement",
  storageBucket: "cube-vehicle-placement.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "CUBE Logistics";
  const options = {
    body: payload.notification?.body || payload.data?.body || "New update",
    icon: "./cube-pin.svg",
    badge: "./cube-pin.svg",
    data: {
      url: "./",
      tripId: payload.data?.tripId || ""
    }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow("./");
    })
  );
});
