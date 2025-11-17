import nodemailer from "nodemailer";
import config from "../config/config.js";

// Read SMTP settings from environment variables. If not provided, the service will
// fall back to a no-op/logging sender to avoid breaking local development.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@arewaflix.com";

let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
} else {
  // No SMTP configured — will log mails to console instead.
  transporter = null;
}

async function sendPasswordResetOtp(email, otp) {
  const subject = "Your password reset code";
  const text = `Your password reset code is: ${otp}. It will expire shortly.`;
  const html = `<p>Your password reset code is: <strong>${otp}</strong>.</p><p>If you didn't request this, ignore this email.</p>`;

  if (!transporter) {
    // Avoid logging full OTP in plain text to reduce accidental leakage in logs.
    const masked = String(otp).slice(0, 2) + "****" + String(otp).slice(-1);
    console.log(
      `[mailService] SMTP not configured — OTP for ${email}: ${masked}`
    );
    return Promise.resolve();
  }

  const msg = {
    from: FROM_EMAIL,
    to: email,
    subject,
    text,
    html,
  };

  return transporter.sendMail(msg);
}

export default { sendPasswordResetOtp };
