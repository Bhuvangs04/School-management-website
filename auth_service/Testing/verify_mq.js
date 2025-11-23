import rabbitMQ from './utils/rabbitmq.js';

const verify = async () => {
    console.log("Starting verification...");
    await rabbitMQ.connect();
    
    // Mock consuming
    await rabbitMQ.consume('user_registered', (data) => {
        console.log("VERIFICATION SUCCESS: Received user data:", data);
        process.exit(0);
    });

    setTimeout(async () => {
        console.log("Publishing test user message...");
        import('amqplib').then(async (amqp) => {
            const conn = await amqp.default.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            const ch = await conn.createChannel();
            await ch.assertQueue('user_registered', { durable: true });
            ch.sendToQueue('user_registered', Buffer.from(JSON.stringify({ 
                name: "Test Student", 
                email: "test.student@example.com",
                role: "student",
                collegeId: "12345"
            })));
            console.log("Test message published.");
            setTimeout(() => {
                console.log("Timeout waiting for message.");
                process.exit(1);
            }, 5000);
        });
    }, 2000);
};

verify();
