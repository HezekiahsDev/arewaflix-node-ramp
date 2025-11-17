import nodemailer from "nodemailer";
import config from "../config/config.js";

// Helper to trim quotes and whitespace from env values
function cleanEnv(v) {
  if (typeof v !== "string") return v;
  let s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}

// Support both SMTP_* and MAIL_* env variable names used in different environments.
const SMTP_HOST = cleanEnv(process.env.SMTP_HOST || process.env.MAIL_HOST);
const SMTP_PORT = cleanEnv(process.env.SMTP_PORT || process.env.MAIL_PORT);
const SMTP_USER = cleanEnv(
  process.env.SMTP_USER || process.env.MAIL_USERNAME || process.env.MAIL_USER
);
const SMTP_PASS = cleanEnv(process.env.SMTP_PASS || process.env.MAIL_PASSWORD);
const DEFAULT_EMAIL_FROM =
  cleanEnv(process.env.FROM_EMAIL) ||
  cleanEnv(process.env.DEFAULT_EMAIL_FROM) ||
  cleanEnv(process.env.MAIL_FROM) ||
  "no-reply@arewaflix.com";

const SECURE_FLAG = cleanEnv(
  process.env.SECURE || process.env.SMTP_SECURE || process.env.MAIL_SECURE
);

let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SECURE_FLAG
        ? String(SECURE_FLAG).toLowerCase() === "true"
        : Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Verify transporter configuration early and log any issues.
    transporter
      .verify()
      .then(() => {
        console.log("mailService: SMTP transporter verified");
      })
      .catch((err) => {
        console.error(
          "mailService: SMTP transporter verification failed:",
          err && err.message ? err.message : err
        );
        // keep transporter as-is; send failures will be handled per-send
      });
  } catch (err) {
    console.error("mailService: failed to create transporter:", err);
    transporter = null;
  }
} else {
  // No SMTP configured — will log mails to console or use ethereal for non-prod
  transporter = null;
}

async function sendPasswordResetOtp(email, otp) {
  const subject = "Your password reset code";
  const text = `Your password reset code is: ${otp}. It will expire shortly.`;
  const html = `<p>Your password reset code is: <strong>${otp}</strong>.</p><p>If you didn't request this, ignore this email.</p>`;

  // If transporter isn't configured, but we're in development, use Ethereal to get a preview URL.
  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        const msg = {
          from: DEFAULT_EMAIL_FROM,
          to: email,
          subject,
          text,
          html,
        };

        const info = await transporter.sendMail(msg);
        const preview = nodemailer.getTestMessageUrl(info);
        console.log(
          `[mailService] Sent test mail (Ethereal) preview: ${preview}`
        );
        return true;
      } catch (err) {
        console.error("mailService: Ethereal send failed:", err);
        // fall through to masked log below
      }
    }

    // Avoid logging full OTP in plain text to reduce accidental leakage in logs.
    const masked = String(otp).slice(0, 2) + "****" + String(otp).slice(-1);
    console.log(
      `[mailService] SMTP not configured — OTP for ${email}: ${masked}`
    );
    return false;
  }

  const msg = {
    from: DEFAULT_EMAIL_FROM,
    to: email,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(msg);
    // If transporter is a test account, provide preview URL when available
    try {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[mailService] mail preview: ${preview}`);
    } catch (e) {
      // ignore
    }
    return true;
  } catch (err) {
    console.error(
      "mailService: sendMail failed:",
      err && err.message ? err.message : err
    );
    return false;
  }
}

export default { sendPasswordResetOtp };
