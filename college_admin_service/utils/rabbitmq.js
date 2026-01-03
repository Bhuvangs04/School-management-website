import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "./logger";
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
            logger.info("RMQ connecting", { url: this.url });

            this.connection = await amqp.connect(this.url);

            this.channel = await this.connection.createChannel();
            logger.info("[RMQ] Connected");

            this.connection.on("close", () => {
                logger.warn("[RMQ] Connection closed → retrying in 5s...");
                this.channel = null;
                this.connection = null;
                setTimeout(() => this.connect(), 5000);
            });

            this.connection.on("error", (err) => {
                logger.error("RMQ connection error", {
                    message: err.message,
                    stack: err.stack
                });
            });

        } catch (err) {
            logger.error("RMQ connection failed", {
                message: err.message,
                stack: err.stack
            });
            this.channel = null;
            this.connection = null;

            setTimeout(() => this.connect(), 5000);
        } finally {
            this.isConnecting = false;
        }
    }

    async assertFanout(exchange) {
        await this.channel.assertExchange(exchange, "fanout", {
            durable: true
        });
    }

    /** FANOUT PUBLISH */
    async publishFanout(exchange, message) {
        const ready = await this.ensureChannel();
        if (!ready) {
            return false;
        }

        try {
            await this.assertFanout(exchange);

            const ok = this.channel.publish(
                exchange,
                "",
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            if (!ok) {
                return false;
            }

            logger.info("RMQ fanout published", { exchange, type: message?.type });
            return true;

        } catch (err) {
            logger.error("RMQ fanout publish failed", {
                exchange,
                message: err.message
            });
            this.channel = null;
            return false;
        }
    }

    /** FANOUT CONSUME */
    async consumeFanout(exchange, queue, callback) {
        const ready = await this.ensureChannel();
        if (!ready) {
            return;
        }

        try {
            await this.assertFanout(exchange);

            const q = await this.channel.assertQueue(queue, {
                durable: true
            });

            await this.channel.bindQueue(q.queue, exchange, "");

            this.channel.consume(q.queue, async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());
                    await callback(content);
                    this.channel.ack(msg);
                } catch (err) {
                    logger.error("RMQ publish failed", {
                        queue,
                        message: err
                    });
                    this.channel.nack(msg, false, true); // retry
                }
            });

            logger.info("RMQ fanout consume", { exchange, type: queue });

        } catch (err) {
            logger.error("RMQ consume error", {
                queue,
                message: err.message
            });
        }
    }



    /** SAFE PUBLISH */
    async publish(queue, message) {
        const ready = await this.ensureChannel();
        if (!ready) {
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
                return false;
            }

            logger.info("RMQ message sent", { queue });
            return true;

        } catch (err) {
            logger.error("RMQ publish failed", {
                queue,
                message: err.message
            });            
            this.channel = null; // Force reconnect next call
            return false;
        }
    }

    async consume(queue, callback) {
        const ready = await this.ensureChannel();
        if (!ready) {
            logger.error(`[RMQ] Cannot consume, channel not ready → ${queue}`);
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
                    logger.error("RMQ consume error", {
                        queue,
                        message: err.message
                    });
                    this.channel.ack(msg); // Avoid infinite poison loop
                }
            });

            logger.info("RMQ consuming", { queue });

        } catch (err) {
            logger.error("RMQ consume error", {
                queue,
                message: err.message
            });
        }
    }
}

export default new RabbitMQ();
