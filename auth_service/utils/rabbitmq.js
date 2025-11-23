import amqp from 'amqplib';
import dotenv from "dotenv";
dotenv.config();

class RabbitMQ {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.url = process.env.RABBITMQ_URL || 'amqp://localhost';
        this.isConnecting = false;
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            console.log('Attempting to connect to RabbitMQ...');
            this.connection = await amqp.connect(this.url);
            this.channel = await this.connection.createChannel();
            console.log('Connected to RabbitMQ');
            this.isConnecting = false;
            
            this.connection.on('close', () => {
                console.warn('RabbitMQ connection closed, retrying in 5s...');
                this.connection = null;
                this.channel = null;
                setTimeout(this.connect.bind(this), 5000);
            });

            this.connection.on('error', (err) => {
                console.error('RabbitMQ connection error', err);
            });

        } catch (error) {
            console.error('Failed to connect to RabbitMQ', error);
            this.isConnecting = false;
            setTimeout(this.connect.bind(this), 5000);
        }
    }

    async consume(queue, callback) {
        if (!this.channel) {
             await this.connect();
        }
        if (!this.channel) {
             console.error(`Cannot consume from ${queue}, channel not available`);
             return;
        }

        try {
            await this.channel.assertQueue(queue, { durable: true });
            this.channel.consume(queue, (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        callback(content);
                        this.channel.ack(msg);
                    } catch (err) {
                        console.error(`Error processing message from ${queue}`, err);
                        this.channel.ack(msg); // Ack to remove poison message
                    }
                }
            });
            console.log(`Started consuming from queue ${queue}`);
        } catch (error) {
            console.error(`Error consuming from queue ${queue}`, error);
        }
    }
}

export default new RabbitMQ();
