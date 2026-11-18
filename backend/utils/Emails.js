const nodemailer = require("nodemailer");

const isPlaceholder = (val = "") =>
  !val ||
  val.includes("your-email") ||
  val.includes("your_email") ||
  val.includes("example.com") ||
  val.includes("your-password") ||
  val.includes("your_password");

const hasMailConfig =
  !isPlaceholder(process.env.EMAIL) && !isPlaceholder(process.env.PASSWORD);

const transporter = hasMailConfig
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    })
  : null;

exports.sendMail = async (receiverEmail, subject, body) => {
  if (!transporter) {
    console.log(`[Email Demo Mode] To: ${receiverEmail} | Subject: ${subject}`);
    return { delivered: false };
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: receiverEmail,
      subject: subject,
      html: body,
    });
    return { delivered: true };
  } catch (err) {
    console.warn(`[Email Fallback] SMTP failed (${err.message}); falling back to demo mode.`);
    return { delivered: false };
  }
};
