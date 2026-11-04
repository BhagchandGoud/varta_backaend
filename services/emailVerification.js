import nodemailer from "nodemailer";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

// email transporter setup
const createTransporter = () => {
  const smtpPassword = process.env.SMTP_PASSWORD?.replace(/\s+/g, "");

  // For Gmail
  if (process.env.SMTP_HOST === 'smtp.gmail.com') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: smtpPassword, // Gmail app password, with display spaces removed
      },
    });
  }

  // For other SMTP providers
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: smtpPassword,
    },
    tls: {
      rejectUnauthorized: false, // For development only
    },
  });
};

const transporter = createTransporter();

// Verify connection on startup
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    return false;
  }
};

// otp store
class OTPStore {
  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  set(email, otpData) {
    this.store.set(email, otpData);
  }

  get(email) {
    return this.store.get(email);
  }

  delete(email) {
    this.store.delete(email);
  }

  cleanup() {
    const now = Date.now();
    for (const [email, data] of this.store) {
      if (data.expiresAt < now) {
        this.store.delete(email);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const otpStore = new OTPStore();

// email service class
class EmailService {
  constructor() {
    this.transporter = transporter;
    this.from = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USERNAME;
    this.otpStore = otpStore;
  }

  //generate otp
  generateOTP(length = 6) {
    return crypto.randomInt(100000, 999999).toString().padStart(length, '0');
  }

  // store otp
  storeOTP(email, otp, expiresInMinutes = 10) {
    const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
    const otpData = {
      otp,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      createdAt: new Date().toISOString(),
    };
    this.otpStore.set(email, otpData);
    return otpData;
  }

//    verify otp
  verifyOTP(email, userOTP) {
    const stored = this.otpStore.get(email);
    
    if (!stored) {
      return { 
        success: false, 
        message: 'OTP not found. Please request a new one.' 
      };
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(email);
      return { 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      };
    }

    if (stored.attempts >= stored.maxAttempts) {
      this.otpStore.delete(email);
      return { 
        success: false, 
        message: 'Too many failed attempts. Please request a new OTP.' 
      };
    }

    if (stored.otp !== userOTP) {
      stored.attempts += 1;
      this.otpStore.set(email, stored);
      return { 
        success: false, 
        message: `Invalid OTP. ${stored.maxAttempts - stored.attempts} attempts remaining.` 
      };
    }

    // Success - clear OTP
    this.otpStore.delete(email);
    return { 
      success: true, 
      message: 'OTP verified successfully' 
    };
  }

  // send email
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      if (!to) {
        throw new Error('Recipient email is required');
      }

      if (process.env.RESEND_API_KEY) {
        if (attachments.length > 0) {
          throw new Error('Attachments are not supported with the Resend transport');
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || this.from,
            to: [to],
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
          }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          const error = new Error(result.message || 'Resend rejected the email');
          error.code = result.name || `RESEND_HTTP_${response.status}`;
          throw error;
        }

        return {
          success: true,
          messageId: result.id,
          response: result,
        };
      }

      const mailOptions = {
        from: this.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return { 
        success: true, 
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        code: error.code,
      };
    }
  }

  //send otp
  async sendVerificationOTP({ email, username }) {
    try {
      // Generate OTP
      const otp = this.generateOTP(6);
      
      // Store OTP with 10-minute expiry
      this.storeOTP(email, otp, 10);

      // Generate HTML template
      const html = this.generateVerificationHTML({ username, otp });
      const text = `Hello ${username},\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`;

      // Send email
      const result = await this.sendEmail({
        to: email,
        subject: 'Verify Your Email Address 🔐',
        html,
        text,
      });

      if (result.success) {
        return {
          success: true,
          message: 'Verification email sent successfully',
          expiresIn: '10 minutes',
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to send verification email',
      };
    }
  }

  // resend otp
  async resendOTP({ email, username }) {
    try {
      // Clear existing OTP
      this.otpStore.delete(email);
      
      // Send new OTP
      return await this.sendVerificationOTP({ email, username });
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to resend OTP',
      };
    }
  }

  async sendIncomingRequestEmail({ email, recipientName, senderName }) {
    return this.sendEmail({
      to: email,
      subject: "You have a new connection request",
      text: `${senderName} sent you a connection request on Varta.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#111b21"><h2 style="color:#00a884">New connection request</h2><p>Hi ${recipientName},</p><p><strong>${senderName}</strong> sent you a connection request on Varta.</p><p>Open Varta to accept or reject it.</p></div>`,
    });
  }

  async sendNearbyUsersEmail({ email, username, nearbyUsers }) {
    const names = nearbyUsers.map((user) => user.name).join(", ");
    return this.sendEmail({
      to: email,
      subject: "People are active near you on Varta",
      text: `${names} ${nearbyUsers.length === 1 ? "is" : "are"} active near you on Varta.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#111b21"><h2 style="color:#00a884">People near you are active</h2><p>Hi ${username},</p><p>${names} ${nearbyUsers.length === 1 ? "is" : "are"} active near your shared location.</p><p>Open Varta to discover and connect with them.</p></div>`,
    });
  }

  // html template
  generateVerificationHTML({ username, otp }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #111b21;
            background: #f0f2f5;
            padding: 20px;
          }
          .container {
            max-width: 520px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 48px 40px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          }
          .header {
            text-align: center;
            margin-bottom: 32px;
          }
          .logo {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: #00a884;
            color: white;
            font-size: 32px;
            margin-bottom: 16px;
          }
          .header h2 {
            font-size: 24px;
            font-weight: 700;
            color: #111b21;
            margin: 0 0 8px;
          }
          .header p {
            font-size: 15px;
            color: #667781;
            margin: 0;
          }
          .header p strong {
            color: #111b21;
          }
          .otp-container {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
            border: 2px dashed #e4e6eb;
          }
          .otp-code {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 12px;
            color: #00a884;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 16px 24px;
            border-radius: 8px;
            display: inline-block;
          }
          .otp-expiry {
            text-align: center;
            font-size: 14px;
            color: #ff6b6b;
            margin: 16px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .otp-expiry svg {
            font-size: 16px;
          }
          .info-text {
            text-align: center;
            font-size: 14px;
            color: #667781;
            margin: 16px 0;
          }
          .divider {
            border: none;
            border-top: 1px solid #e4e6eb;
            margin: 24px 0;
          }
          .footer {
            text-align: center;
            font-size: 13px;
            color: #8e8e91;
            margin-top: 24px;
          }
          .footer a {
            color: #00a884;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          @media (max-width: 480px) {
            .container {
              padding: 32px 20px;
            }
            .otp-code {
              font-size: 36px;
              letter-spacing: 8px;
              padding: 12px 16px;
            }
            .header h2 {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo">🔐</div>
            <h2>Verify Your Email</h2>
            <p>
              Hello <strong>${username}</strong>!<br>
              Please use the verification code below to verify your email address.
            </p>
          </div>

          <!-- OTP Section -->
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>

          <!-- Expiry -->
          <div class="otp-expiry">
            <span>⏰</span>
            <span>This code will expire in <strong>10 minutes</strong></span>
          </div>

          <!-- Info -->
          <p class="info-text">
            If you didn't request this verification, please ignore this email.
          </p>

          <hr class="divider">

          <!-- Footer -->
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p style="margin-top: 8px;">
              &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // send password reset email
  async sendPasswordResetEmail({ email, username, resetToken, resetUrl }) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #111b21; background: #f0f2f5; padding: 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
          .header { text-align: center; margin-bottom: 32px; }
          .logo { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: #00a884; color: white; font-size: 32px; margin-bottom: 16px; }
          .header h2 { font-size: 24px; font-weight: 700; color: #111b21; margin: 0 0 8px; }
          .header p { font-size: 15px; color: #667781; margin: 0; }
          .button-container { text-align: center; margin: 32px 0; }
          .reset-button { display: inline-block; padding: 14px 40px; background: #00a884; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: all 0.2s; }
          .reset-button:hover { background: #008f72; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0, 168, 132, 0.3); }
          .link-container { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; word-break: break-all; font-size: 14px; color: #667781; }
          .link-container a { color: #00a884; text-decoration: none; }
          .divider { border: none; border-top: 1px solid #e4e6eb; margin: 24px 0; }
          .footer { text-align: center; font-size: 13px; color: #8e8e91; margin-top: 24px; }
          @media (max-width: 480px) { .container { padding: 32px 20px; } .header h2 { font-size: 20px; } .reset-button { padding: 12px 32px; font-size: 15px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔑</div>
            <h2>Reset Your Password</h2>
            <p>Hello <strong>${username}</strong>!<br>We received a request to reset your password.</p>
          </div>

          <div class="button-container">
            <a href="${resetUrl}" class="reset-button">Reset Password</a>
          </div>

          <p style="text-align: center; font-size: 14px; color: #667781;">
            Or copy and paste this link in your browser:
          </p>
          <div class="link-container">
            <a href="${resetUrl}">${resetUrl}</a>
          </div>

          <p style="text-align: center; font-size: 14px; color: #ff6b6b;">
            ⏰ This link will expire in <strong>1 hour</strong>
          </p>

          <p style="text-align: center; font-size: 14px; color: #667781; margin-top: 16px;">
            If you didn't request this, please ignore this email.
          </p>

          <hr class="divider">

          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Hello ${username},\n\nReset your password using this link:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password 🔑',
      html,
      text,
    });
  }

  // send welcome email
  async sendWelcomeEmail({ email, username }) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #111b21; background: #f0f2f5; padding: 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
          .header { text-align: center; margin-bottom: 32px; }
          .logo { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; background: #00a884; color: white; font-size: 32px; margin-bottom: 16px; }
          .header h2 { font-size: 24px; font-weight: 700; color: #111b21; margin: 0 0 8px; }
          .header p { font-size: 15px; color: #667781; margin: 0; }
          .features { margin: 24px 0; }
          .feature { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; margin: 8px 0; }
          .feature-icon { font-size: 20px; color: #00a884; }
          .divider { border: none; border-top: 1px solid #e4e6eb; margin: 24px 0; }
          .footer { text-align: center; font-size: 13px; color: #8e8e91; margin-top: 24px; }
          @media (max-width: 480px) { .container { padding: 32px 20px; } .header h2 { font-size: 20px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎉</div>
            <h2>Welcome ${username}!</h2>
            <p>You're all set! We're excited to have you on board.</p>
          </div>

          <div class="features">
            <div class="feature">
              <span class="feature-icon">✅</span>
              <span>Complete your profile</span>
            </div>
            <div class="feature">
              <span class="feature-icon">🚀</span>
              <span>Explore our features</span>
            </div>
            <div class="feature">
              <span class="feature-icon">👥</span>
              <span>Connect with others</span>
            </div>
          </div>

          <p style="text-align: center; font-size: 14px; color: #667781;">
            If you have any questions, feel free to contact our support team.
          </p>

          <hr class="divider">

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome ${username}! We're excited to have you on board.\n\nComplete your profile, explore our features, and connect with others.\n\nIf you have any questions, feel free to contact our support team.`;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Our Platform! 🎉',
      html,
      text,
    });
  }

 
  // get otp status
  getOTPStatus(email) {
    const stored = this.otpStore.get(email);
    if (!stored) return { exists: false };
    
    return {
      exists: true,
      expiresAt: stored.expiresAt,
      attempts: stored.attempts,
      maxAttempts: stored.maxAttempts,
      remainingAttempts: stored.maxAttempts - stored.attempts,
      isExpired: Date.now() > stored.expiresAt,
    };
  }

  //clean up
  cleanup() {
    this.otpStore.destroy();
  }
}


// const emailService = new EmailService();
export default EmailService;