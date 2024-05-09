const nodeMailer = require("nodemailer");

const sendRegistrationEmail = async (recipientEmail, subject, text, html) => {
    // Create a separate email function for registration emails
    const transporter = nodeMailer.createTransport({
        host: process.env.SMPT_HOST || " smtp.gmail.com",
        port: process.env.SMPT_PORT || 465,
        service: process.env.SMPT_SERVICE || "gmail",
        auth: {
            user: process.env.SMPT_MAIL || "faheemakhtar19730@gmail.com",
            pass: process.env.SMPT_PASSWORD || "rlavjxknhezrpmbo",
        },
    });

    const mailOptions = {
        from: process.env.SMPT_MAIL || "faheemakhtar19730@gmail.com",
        to: recipientEmail,
        subject: subject,
        text: text, // Plain text message for registration
        html: html,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendRegistrationEmail