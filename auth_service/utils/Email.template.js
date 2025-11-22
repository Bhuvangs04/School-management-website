
const baseStyles = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
  line-height: 1.6;
`;

const containerStyle = `
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
`;

const headerStyle = `
  background-color: #4F46E5;
  color: #ffffff;
  padding: 20px;
  text-align: center;
  font-size: 24px;
  font-weight: bold;
`;

const contentStyle = `
  padding: 30px 20px;
`;

const footerStyle = `
  background-color: #f9fafb;
  padding: 15px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
`;

const buttonStyle = `
  display: inline-block;
  background-color: #4F46E5;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
  margin-top: 20px;
`;

export const getOtpHtml = (otp) => {
    return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          Verification Code
        </div>
        <div style="${contentStyle}">
          <h2 style="margin-top: 0;">Hello,</h2>
          <p>You requested a verification code to access your account. Please use the code below to complete your request:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; background: #f3f4f6; padding: 10px 20px; border-radius: 8px;">
              ${otp}
            </span>
          </div>

          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

export const getNewDeviceHtml = ({ deviceId, ip, geo, riskScore }) => {
    return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          New Login Detected
        </div>
        <div style="${contentStyle}">
          <h2 style="margin-top: 0;">Was this you?</h2>
          <p>We noticed a new login to your account from a device we don't recognize.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #f9fafb; border-radius: 8px;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Device ID</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${deviceId || "Unknown"}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Location</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${geo?.city || "Unknown"}, ${geo?.country || ""}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">IP Address</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${ip || "Unknown"}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: bold; color: #4b5563;">Risk Score</td>
              <td style="padding: 12px;">${riskScore ?? "N/A"}</td>
            </tr>
          </table>

          <p style="margin-top: 25px;">If this was you, no further action is needed.</p>
          <p><strong>If this wasn't you, please reset your password immediately.</strong></p>
        </div>
        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

export const getTokenReuseHtml = ({ deviceId, ip, geo, riskScore }) => {
    return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">
        <div style="${headerStyle}" style="background-color: #DC2626;">
          Security Alert
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #DC2626; margin-top: 0;">Critical: Token Reuse Detected</h2>
          <p>We detected a suspicious attempt to reuse an old authentication token. To protect your account, <strong>we have revoked all active sessions</strong>.</p>
          
          <div style="background-color: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 15px; border-radius: 6px; margin: 20px 0;">
             <strong>Suspicious Activity Details:</strong><br/>
             IP: ${ip || "Unknown"}<br/>
             Location: ${geo?.city || "Unknown"}, ${geo?.country || ""}<br/>
             Device: ${deviceId || "Unknown"}
             Risk Score : ${riskScore || "Null"} 
          </div>

          <p>Please log in again to re-authenticate your devices.</p>
        </div>
        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>
      </div>
    </div>
  `;
};