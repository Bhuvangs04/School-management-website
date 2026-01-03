import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: "college-service"
    },
    transports: [
        new winston.transports.File({
            filename: "/var/log/school-app/college-error.log",
            level: "error"
        }),
        new winston.transports.File({
            filename: "/var/log/school-app/college.log"
        })
    ]
});

if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.simple()
        })
    );
}

export default logger;
