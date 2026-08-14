/* Lock-screen body is always generic (FR-068). */
self.addEventListener("push", (event) => {
  let body = "You have a note in GirlCode360";
  try {
    const data = event.data ? event.data.json() : {};
    if (typeof data.body === "string" && !/period|ovulat|pregnan|fertile|medication|pcos|pmos|symptom/i.test(data.body)) {
      body = data.body;
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification("GirlCode360", {
      body,
      data: { url: "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(self.clients.openWindow(url));
});
