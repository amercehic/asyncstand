import fs from 'fs';
import path from 'path';
import mjml from 'mjml';

const generatePasswordResetEmail = (email: string, token: string, userName?: string) => {
  const resetUrl = `http://localhost:3000/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  const mjmlTemplate = `
    <mjml>
      <mj-head>
        <mj-title>Password Reset Request</mj-title>
        <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" />
        <mj-attributes>
          <mj-all font-family="Roboto, Arial, sans-serif" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f4f4f4">
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column>
            <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
              Password Reset Request
            </mj-text>
            
            <mj-text font-size="16px" color="#666666" line-height="24px">
              Hello ${userName || 'there'},
            </mj-text>
            
            <mj-text font-size="16px" color="#666666" line-height="24px">
              We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
            </mj-text>
            
            <mj-text font-size="16px" color="#666666" line-height="24px">
              To reset your password, click the button below:
            </mj-text>
            
            <mj-button background-color="#007bff" color="white" href="${resetUrl}" font-size="16px" padding="12px 24px">
              Reset Password
            </mj-button>
            
            <mj-text font-size="14px" color="#999999" line-height="20px">
              This link will expire in 24 hours for security reasons.
            </mj-text>
            
            <mj-text font-size="14px" color="#999999" line-height="20px">
              If the button doesn't work, you can copy and paste this link into your browser:
            </mj-text>
            
            <mj-text font-size="12px" color="#999999" word-break="break-all">
              ${resetUrl}
            </mj-text>
            
            <mj-text font-size="14px" color="#999999" line-height="20px">
              Best regards,<br/>
              The AsyncStand Team
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  return mjml(mjmlTemplate);
};

const main = () => {
  const email = 'test@example.com';
  const token = '550e8400-e29b-41d4-a716-446655440000';
  const userName = 'John Doe';

  const { html } = generatePasswordResetEmail(email, token, userName);

  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, '../email-previews');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write HTML file
  const htmlPath = path.join(outputDir, 'password-reset-email.html');
  fs.writeFileSync(htmlPath, html);

  // Write MJML file for reference
  const mjmlPath = path.join(outputDir, 'password-reset-email.mjml');
  const mjmlContent = generatePasswordResetEmail(email, token, userName);
  fs.writeFileSync(mjmlPath, mjmlContent.html);

  console.log('Email preview generated!');
  console.log(`HTML: ${htmlPath}`);
  console.log(`MJML: ${mjmlPath}`);
  console.log('\nYou can open the HTML file in your browser to preview the email.');
};

main();
