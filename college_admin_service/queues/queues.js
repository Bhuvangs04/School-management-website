import { Queue } from "bullmq";

import { connection } from "../lib/redis.js";



export const studentImportQueue = new Queue("studentImportQueue", { connection });
export const notificationQueue = new Queue("notificationQueue", { connection });
export const auditQueue = new Queue("auditQueue", { connection });
export const notificationDLQ = new Queue("notificationDLQ", { connection });

export default { studentImportQueue, notificationQueue, auditQueue, notificationDLQ };
