export function oneTimeCredentialHtml({ name, email, tempPassword, loginUrl }) {
    return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2>Welcome, ${name}</h2>
    <p>Your account has been created for ${email}.</p>
    <p><strong>Temporary Password:</strong> ${tempPassword}</p>
    <p>Please login at <a href="${loginUrl}">${loginUrl}</a> and change your password immediately.</p>
    <p>This temporary password will expire on first login.</p>
    <hr/>
    <small>School App</small>
  </div>`;
}
