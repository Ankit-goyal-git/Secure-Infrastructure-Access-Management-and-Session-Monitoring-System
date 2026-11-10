const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter object using Gmail SMTP or custom SMTP
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Sends a high-security 6-digit OTP verification email via Gmail.
 * Falls back to terminal logging if SMTP credentials are not yet configured in .env.
 */
exports.sendOtpEmail = async (toEmail, otp, purpose = 'Login Verification') => {
  const user = process.env.EMAIL_USER;
  const fromAddress = process.env.EMAIL_FROM || `"Secure PAM Gateway" <${user || 'no-reply@securegateway.internal'}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Security Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #e2e8f0; }
        .container { max-width: 520px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #1e293b; }
        .title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.02em; }
        .subtitle { color: #94a3b8; font-size: 13px; margin: 0; }
        .body { padding: 32px 28px; }
        .text { color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .otp-box { background: #0f172a; border: 1px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 800; color: #60a5fa; letter-spacing: 8px; margin: 0; }
        .meta { color: #64748b; font-size: 12px; text-align: center; margin: 8px 0 0 0; }
        .warning { background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 12px 14px; border-radius: 4px; color: #fca5a5; font-size: 12px; line-height: 1.5; margin: 24px 0 0 0; }
        .footer { background: #0b1120; padding: 16px 24px; text-align: center; color: #475569; font-size: 11px; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">🔐 Secure Infrastructure Access</h1>
          <p class="subtitle">Zero-Trust Privileged Access Management Portal</p>
        </div>
        <div class="body">
          <p class="text">Hello,</p>
          <p class="text">You requested a <strong>${purpose}</strong> code for your account. Enter this one-time security passkey in the portal to verify your identity:</p>
          
          <div class="otp-box">
            <h2 class="otp-code">${otp}</h2>
            <p class="meta">Valid for exactly 10 minutes</p>
          </div>

          <div class="warning">
            <strong>Security Alert:</strong> Never share this code with anyone. PAM administrators will never ask for your one-time verification password.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 Secure Infrastructure Access Management System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
[Secure Infrastructure Access Management]
Your ${purpose} verification code is: ${otp}
This code will expire in 10 minutes.
Do NOT share this code with anyone.
  `;

  const transporter = createTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `[${otp}] Your PAM Portal Security Verification Code`,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[EMAIL DISPATCH] Real Gmail OTP successfully sent to ${toEmail} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, live: true };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send via Gmail SMTP to ${toEmail}:`, err.message);
      // Fallback display to prevent dev lockouts
      console.log(`\n======================================================`);
      console.log(`[FALLBACK DEV OTP] Target: ${toEmail} | Code: ${otp}`);
      console.log(`======================================================\n`);
      return { success: false, fallback: true, error: err.message, devOtp: otp };
    }
  } else {
    // Development mode fallback when EMAIL_USER is not set
    console.log(`\n======================================================`);
    console.log(`[DEV MODE - NO GMAIL CONFIGURED]`);
    console.log(`Target: ${toEmail}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP Code: >>> ${otp} <<<`);
    console.log(`To enable live Gmail delivery, add EMAIL_USER & EMAIL_APP_PASSWORD in .env`);
    console.log(`======================================================\n`);
    return { success: true, fallback: true, devOtp: otp };
  }
};
