import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

class RabbitMQ {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.url = process.env.RABBITMQ_URL || "amqp://localhost";
        this.isConnecting = false;
    }

    /* ================= CONNECTION ================= */

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            console.log("[RMQ] Connecting...");
            this.connection = await amqp.connect(this.url);
            this.channel = await this.connection.createChannel();
            console.log("[RMQ] Connected");

            this.connection.on("close", () => {
                console.warn("[RMQ] Connection closed → retrying in 5s");
                this.connection = null;
                this.channel = null;
                setTimeout(() => this.connect(), 5000);
            });

            this.connection.on("error", (err) => {
                console.error("[RMQ] Connection error:", err.message);
            });

        } catch (err) {
            console.error("[RMQ] Connection failed:", err.message);
            this.connection = null;
            this.channel = null;
            setTimeout(() => this.connect(), 5000);
        } finally {
            this.isConnecting = false;
        }
    }

    async ensureChannel() {
        if (this.channel) return true;
        await this.connect();
        return !!this.channel;
    }

    /* ================= QUEUE (POINT-TO-POINT) ================= */

    async publish(queue, message) {
        const ready = await this.ensureChannel();
        if (!ready) return false;

        try {
            await this.channel.assertQueue(queue, { durable: true });

            return this.channel.sendToQueue(
                queue,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );
        } catch (err) {
            console.error(`[RMQ] Queue publish error (${queue})`, err);
            return false;
        }
    }

    async consume(queue, callback) {
        const ready = await this.ensureChannel();
        if (!ready) return;

        try {
            await this.channel.assertQueue(queue, { durable: true });

            this.channel.consume(queue, async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());
                    await callback(content);
                    this.channel.ack(msg);
                } catch (err) {
                    console.error(`[RMQ] Queue consume error (${queue})`, err);
                    this.channel.ack(msg); // prevent poison loop
                }
            });

            console.log(`[RMQ] Consuming queue → ${queue}`);
        } catch (err) {
            console.error(`[RMQ] Consume setup failed (${queue})`, err);
        }
    }

    /* ================= FANOUT (BROADCAST) ================= */

    async assertFanoutExchange(exchange) {
        await this.channel.assertExchange(exchange, "fanout", {
            durable: true
        });
    }

    async publishFanout(exchange, message) {
        const ready = await this.ensureChannel();
        if (!ready) return false;

        try {
            await this.assertFanoutExchange(exchange);

            return this.channel.publish(
                exchange,
                "",
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );
        } catch (err) {
            console.error(`[RMQ] Fanout publish error (${exchange})`, err);
            return false;
        }
    }

    async consumeFanout(exchange, queue, callback) {
        const ready = await this.ensureChannel();
        if (!ready) return;

        try {
            await this.assertFanoutExchange(exchange);

            const q = await this.channel.assertQueue(queue, { durable: true });
            await this.channel.bindQueue(q.queue, exchange, "");

            this.channel.consume(q.queue, async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());
                    await callback(content);
                    this.channel.ack(msg);
                } catch (err) {
                    console.error(`[RMQ] Fanout consume error (${queue})`, err);
                    this.channel.nack(msg, false, true); // retry
                }
            });

            console.log(`[RMQ] Fanout consuming → ${exchange} → ${queue}`);
        } catch (err) {
            console.error(`[RMQ] Fanout setup failed`, err);
        }
    }
}

export default new RabbitMQ();
