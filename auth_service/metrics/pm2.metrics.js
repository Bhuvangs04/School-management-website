import io from "@pm2/io";

export const metrics = {
    loginAttempts: io.counter({
        name: "Login Attempts",
        id: "login_attempts"
    }),

    loginFailed: io.counter({
        name: "Failed Logins",
        id: "failed_logins"
    }),

    successfulLogins: io.counter({
        name: "Successful Logins",
        id: "successful_logins"
    }),

    usersRegistered: io.counter({
        name: "User Registrations",
        id: "user_registrations"
    }),

    otpRequests: io.counter({
        name: "OTP Requests",
        id: "otp_requests"
    }),

    passwordResets: io.counter({
        name: "Password Resets",
        id: "password_resets"
    }),

    sessionCreated: io.counter({
        name: "Session Created",
        id: "session_created"
    }),

    sessionRevoked: io.counter({
        name: "Session Revoked",
        id: "session_revoked"
    }),

    tokenReuseDetected: io.counter({
        name: "Token Reuse Detected",
        id: "token_reuse_detected"
    }),

    newDeviceAlert: io.counter({
        name: "New Device Alert",
        id: "new_device_alert"
    }),

    trustDevice: io.counter({
        name: "Trusted Device",
        id: "trusted_device"
    })
};
