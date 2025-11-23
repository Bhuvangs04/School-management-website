module.exports = {
    apps: [
        {
            name: "college-service",
            script: "./server.js",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
            }
        },
        {
            name: "student-import-worker",
            script: "./workers/studentImport.worker.js",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
            }
        }
    ]
};
