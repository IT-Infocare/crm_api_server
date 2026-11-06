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

/**
 * Send a user-drafted email. The mailbox itself is the company SMTP account, but the
 * message is sent in the current user's name, replies go to the user, and the user is CC'd.
 */
async function sendLeadEmail({ to, subject, body, senderName, senderEmail }) {
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  const addr = (smtpFrom.match(/<([^>]+)>/) || [null, smtpFrom])[1];
  const name = String(senderName || '').replace(/["<>\r\n]/g, '').trim();
  await getTransporter().sendMail({
    from: name ? `"${name} - Infocare" <${addr}>` : smtpFrom,
    replyTo: senderEmail || undefined,
    cc: senderEmail || undefined,
    to,
    subject,
    text: body,
  });
}

module.exports = { isConfigured, sendResetCode, sendLeadEmail };
