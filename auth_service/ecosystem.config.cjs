module.exports = {
    apps: [
        {
            name: "auth-api",
            script: "index.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "notification-worker",
            script: "workers/notification.worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "audit-worker",
            script: "workers/audit.worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "dlq-worker",
            script: "workers/dlq.worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
