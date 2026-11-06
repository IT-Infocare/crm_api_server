const nodemailer = require('nodemailer');

// Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and (optionally) SMTP_FROM.
function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendResetCode(to, name, code) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your Field CRM password reset code',
    text:
      `Hello ${name || ''},\n\n` +
      `Your Field CRM password reset code is ${code}.\n` +
      `It is valid for about 15 minutes. If you did not ask for this, you can ignore this email.\n`,
  });
}

module.exports = { isConfigured, sendResetCode };
