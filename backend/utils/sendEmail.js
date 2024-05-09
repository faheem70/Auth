const nodeMailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodeMailer.createTransport({

    host: process.env.SMPT_HOST || "smtp.gmail.com",
    port: process.env.SMPT_PORT || 465,
    service: process.env.SMPT_SERVICE || "gmail",
    auth: {

      user: process.env.SMPT_MAIL || " faheemakhtar19730@gmail.com",
      pass: process.env.SMPT_PASSWORD || "rlavjxknhezrpmbo",
    },
  });

  const mailOptions = {

    from: process.env.SMPT_MAIL || "faheemakhtar19730@gmail.com",
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;