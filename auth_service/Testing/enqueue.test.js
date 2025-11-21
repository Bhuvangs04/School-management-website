import { notificationQueue } from "../queues/notification.queue.js";

(async () => {
    const payload = {
        userId: "000000000000000000000000",
        email: "bhuvangs2004@gmail.com",
        deviceId: "test-device-1",
        ip: "127.0.0.1",
        geo: { country: "IN", city: "YourCity" },
        riskScore: 10,
        audit: { userId: "000000...", event: "TEST" }
    };

    const job = await notificationQueue.add("newDeviceEmail", payload, { attempts: 2, removeOnComplete: true });
    console.log("Enqueued test job", job.id);
    process.exit(0);
})();
