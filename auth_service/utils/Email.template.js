
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

export const getNewDeviceHtml = ({ deviceId, ip, geo, riskScore, approveUrl }) => {
  return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          New Login Detected
        </div>
        <div style="${contentStyle}">
          <h2 style="margin-top: 0;">Was this you?</h2>
          <p>We noticed a new login from a device not previously seen.</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #f9fafb; border-radius: 8px;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Device ID</td>
              <td style="padding: 12px;">${deviceId}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Location</td>
              <td style="padding: 12px;">${geo?.city || "Unknown"}, ${geo?.country || "Unknown"}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: bold; color: #4b5563;">IP Address</td>
              <td style="padding: 12px;">${ip}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: bold; color: #4b5563;">Risk Score</td>
              <td style="padding: 12px;">${riskScore}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">If this was you, please approve the device:</p>

          <div style="text-align:center;">
            <a href="${approveUrl}" style="${buttonStyle}">
              Approve This Device
            </a>
          </div>

          <p style="margin-top: 20px; color: #666;">If this was not you, please change your password immediately.</p>
        </div>

        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

export const getOneTimeEmail = ({ name, email, role, tempory_password }) => {
  return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">

        <!-- HEADER -->
        <div style="${headerStyle}">
          Welcome to School App 🎉
        </div>

        <!-- CONTENT -->
        <div style="${contentStyle}">
          <h2 style="margin-top: 0;">Hi ${name || "there"},</h2>

          <p>We're happy to welcome you to the <strong>School Management System</strong>.</p>

          <p>Your account has been successfully created as a 
            <strong style="color:#4F46E5;">${role?.toUpperCase() || "USER"}</strong>.
          </p>

          <p>Below are your login credentials:</p>

          <table style="width:100%; margin:20px 0; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
            <tr>
              <td style="padding:12px; border-bottom:1px solid #e5e7eb; font-weight:bold; color:#4b5563;">Email</td>
              <td style="padding:12px;">${email}</td>
            </tr>
            <tr>
              <td style="padding:12px; font-weight:bold; color:#4b5563;">Temporary Password</td>
              <td style="padding:12px;">
                <span style="font-weight:bold; background:#f3f4f6; padding:6px 12px; border-radius:6px;">
                  ${tempory_password}
                </span>
              </td>
            </tr>
          </table>

          <p style="font-size:14px; color:#555;">
            For security reasons, you will be required to change this password when you first log in.
          </p>

          <div style="text-align:center; margin-top: 30px;">
            <a href="${process.env.CLIENT_URL}/auth/login" style="${buttonStyle}">
              Login to Your Account
            </a>
          </div>

          <p style="margin-top:25px; font-size:14px; color:#666;">
            If you did not request this account, please ignore this email.
          </p>
        </div>

        <!-- FOOTER -->
        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>

      </div>
    </div>
  `;
};



export const getTokenReuseHtml = ({ deviceId, ip, geo, riskScore, revokeUrl, revokeAllUrl }) => {
  return `
    <div style="${baseStyles}">
      <div style="${containerStyle}">
        <div style="background-color:#DC2626; color:#fff; padding:20px; text-align:center; font-size:24px; font-weight:bold;">
          Security Alert
        </div>

        <div style="${contentStyle}">
          <h2 style="color:#DC2626; margin-top:0;">Token Reuse Detected</h2>
          <p>We detected an attempt to reuse an invalidated refresh token.</p>

          <div style="background-color: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 15px; border-radius: 6px; margin: 20px 0;">
             <strong>Suspicious Activity:</strong><br/>
             Device: ${deviceId}<br/>
             IP: ${ip}<br/>
             Location: ${geo?.city}, ${geo?.country}<br/>
             Risk Score: ${riskScore}
          </div>

          <p>Please take one of the following actions:</p>

          <div style="text-align:center; margin-top:25px;">
            <a href="${revokeUrl}" style="${buttonStyle} background:#DC2626;">
              Revoke This Device
            </a>
          </div>

          <div style="text-align:center; margin-top:15px;">
            <a href="${revokeAllUrl}" style="${buttonStyle} background:#111;">
              Revoke ALL Sessions
            </a>
          </div>

        </div>

        <div style="${footerStyle}">
          &copy; ${new Date().getFullYear()} School App. All rights reserved.
        </div>
      </div>
    </div>
  `;
};
