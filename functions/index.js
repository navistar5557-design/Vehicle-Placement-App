const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();

async function sendOperationalNotification({ title, body, tripId = "", type = "general" }) {
  const createdAt = Date.now();

  await db.collection("notifications").add({
    title,
    body,
    tripId,
    type,
    target: "all",
    createdAt
  });

  const tokenSnap = await db.collection("deviceTokens").where("active", "==", true).get();
  const tokenDocs = tokenSnap.docs
    .map((doc) => ({ ref: doc.ref, token: doc.get("token") }))
    .filter((row) => typeof row.token === "string" && row.token.length > 20);

  if (!tokenDocs.length) return;

  for (let offset = 0; offset < tokenDocs.length; offset += 500) {
    const batch = tokenDocs.slice(offset, offset + 500);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch.map((row) => row.token),
      notification: { title, body },
      data: {
        title,
        body,
        tripId: String(tripId || ""),
        type
      },
      android: {
        priority: "high",
        notification: {
          channelId: "cube_operations",
          sound: "default"
        }
      },
      webpush: {
        fcmOptions: {
          link: "https://navistar5557-design.github.io/Vehicle-Placement-App/"
        }
      }
    });

    const invalid = [];
    response.responses.forEach((result, i) => {
      if (result.success) return;
      const code = result.error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token") ||
        code.includes("invalid-argument")
      ) {
        invalid.push(batch[i].ref);
      }
    });

    if (invalid.length) {
      const writeBatch = db.batch();
      invalid.forEach((ref) => writeBatch.set(ref, { active: false, updatedAt: Date.now() }, { merge: true }));
      await writeBatch.commit();
    }
  }
}

exports.notifyTripCreated = onDocumentCreated("trips/{tripId}", async (event) => {
  const trip = event.data?.data();
  if (!trip) return;

  const vehicle = trip.vehicle || "Vehicle";
  const from = trip.from || "";
  const to = trip.to || "";
  const route = from || to ? ` — ${from} → ${to}` : "";

  await sendOperationalNotification({
    title: "New Trip Created",
    body: `${vehicle}${route}`,
    tripId: event.params.tripId,
    type: "trip_created"
  });
});

exports.notifyTripStatusChanged = onDocumentUpdated("trips/{tripId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  const oldStatus = before.status || "Vehicle Placed";
  const newStatus = after.status || "Vehicle Placed";
  if (oldStatus === newStatus) return;

  const vehicle = after.vehicle || "Vehicle";
  const updater = after.statusUpdatedBy || after.statusUpdatedByEmail || "User";

  await sendOperationalNotification({
    title: `Trip Status: ${newStatus}`,
    body: `${vehicle} updated by ${updater}`,
    tripId: event.params.tripId,
    type: "trip_status"
  });
});
