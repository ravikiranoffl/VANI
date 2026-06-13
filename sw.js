// sw.js - Required by OS to allow background notifications and clicks
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // When clicked, force the OS to open/focus the VANI tab
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        if (clientList.length > 0) return clientList[0].focus();
        return clients.openWindow("/");
      }),
  );
});
