import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

class RabbitMQ {
    constructor() {
        this.url = process.env.RABBITMQ_URL;
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
    }

    /** Ensure we have a connected channel */
    async ensureChannel() {
        if (this.channel) return true;

        await this.connect();
        return !!this.channel;
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            console.log("[RMQ] Connecting...");

            this.connection = await amqp.connect(this.url);

            this.channel = await this.connection.createChannel();
            console.log("[RMQ] Connected");

            this.connection.on("close", () => {
                console.warn("[RMQ] Connection closed → retrying in 5s...");
                this.channel = null;
                this.connection = null;
                setTimeout(() => this.connect(), 5000);
            });

            this.connection.on("error", (err) => {
                console.error("[RMQ] Connection error:", err.message);
            });

        } catch (err) {
            console.error("[RMQ] Connection failed:", err.message);
            this.channel = null;
            this.connection = null;

            setTimeout(() => this.connect(), 5000);
        } finally {
            this.isConnecting = false;
        }
    }

    /** SAFE PUBLISH */
    async publish(queue, message) {
        const ready = await this.ensureChannel();
        if (!ready) {
            console.error(`[RMQ] Publish failed, channel not ready → queue=${queue}`);
            return false;
        }

        try {
            await this.channel.assertQueue(queue, { durable: true });

            const ok = this.channel.sendToQueue(
                queue,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            if (!ok) {
                console.error(`[RMQ] sendToQueue returned false for ${queue}`);
                return false;
            }

            console.log(`[RMQ] Message sent → ${queue}`);
            return true;

        } catch (err) {
            console.error(`[RMQ] Publish error → ${queue}:`, err.message);
            this.channel = null; // Force reconnect next call
            return false;
        }
    }

    async consume(queue, callback) {
        const ready = await this.ensureChannel();
        if (!ready) {
            console.error(`[RMQ] Cannot consume, channel not ready → ${queue}`);
            return;
        }

        try {
            await this.channel.assertQueue(queue, { durable: true });

            this.channel.consume(queue, async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());
                    await callback(content);
                    this.channel.ack(msg);

                } catch (err) {
                    console.error(`[RMQ] Error processing ${queue}:`, err);
                    this.channel.ack(msg); // Avoid infinite poison loop
                }
            });

            console.log(`[RMQ] Consuming → ${queue}`);

        } catch (err) {
            console.error(`[RMQ] Consume error → ${queue}:`, err.message);
        }
    }
}

export default new RabbitMQ();
