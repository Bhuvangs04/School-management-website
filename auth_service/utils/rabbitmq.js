import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "./logger";
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
            logger.info("RMQ connecting", {
                category: "mq",
                url: this.url
            });
            this.connection = await amqp.connect(this.url);
            this.channel = await this.connection.createChannel();
            logger.info("RMQ connected", {
                category: "mq"
            });

            this.connection.on("close", () => {
                logger.warn("RMQ connection closed, retrying", {
                    category: "mq"
                });
                this.connection = null;
                this.channel = null;
                setTimeout(() => this.connect(), 5000);
            });

            this.connection.on("error", (err) => {
                logger.error("RMQ connection error", {
                    category: "mq",
                    message: err.message,
                    stack: err.stack
                });
            });

        } catch (err) {
            logger.error("RMQ connection failed", {
                category: "mq",
                message: err.message,
                stack: err.stack
            });            
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

            logger.info("RMQ queue message published", {
                category: "mq",
                queue
            });

            return this.channel.sendToQueue(
                queue,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

        } catch (err) {
            logger.error("RMQ queue publish failed", {
                category: "mq",
                queue,
                message: err.message,
                stack: err.stack
            });
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
                    logger.error("RMQ queue consume error", {
                        category: "mq",
                        queue,
                        message: err.message,
                        stack: err.stack
                    });

                    this.channel.ack(msg); // prevent poison loop
                }
            });

            logger.info("RMQ queue consuming", {
                category: "mq",
                queue
            });
        } catch (err) {
            logger.error("RMQ queue consume setup failed", {
                category: "mq",
                queue,
                message: err.message,
                stack: err.stack
            });
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

            logger.info("RMQ fanout published", {
                category: "mq",
                exchange,
                eventType: message?.type
            });

            return this.channel.publish(
                exchange,
                "",
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );
        } catch (err) {
            logger.error("RMQ fanout publish failed", {
                category: "mq",
                exchange,
                message: err.message,
                stack: err.stack
            });
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
                    logger.error("RMQ fanout consume error", {
                        category: "mq",
                        exchange,
                        queue,
                        message: err.message,
                        stack: err.stack
                    });
                    this.channel.nack(msg, false, true); // retry
                }
            });

            logger.info("RMQ fanout consuming", {
                category: "mq",
                exchange,
                queue
            });
        } catch (err) {
            logger.error("RMQ fanout consume setup failed", {
                category: "mq",
                exchange,
                queue,
                message: err.message,
                stack: err.stack
            });
        }
    }
}

export default new RabbitMQ();
