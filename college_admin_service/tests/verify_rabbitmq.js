import rabbitMQ from '../utils/rabbitmq.js';
import logger from '../utils/logger.js';

const verify = async () => {
    try {
        await rabbitMQ.connect();
        console.log('Connected to RabbitMQ');

        const queue = 'test_queue';
        const message = { text: 'Hello RabbitMQ' };

        await rabbitMQ.publish(queue, message);
        console.log('Published message');

        await rabbitMQ.consume(queue, (msg) => {
            console.log('Received message:', msg);
            if (msg.text === 'Hello RabbitMQ') {
                console.log('Verification Successful');
                process.exit(0);
            }
        });

    } catch (error) {
        console.error('Verification Failed', error);
        process.exit(1);
    }
};

verify();
