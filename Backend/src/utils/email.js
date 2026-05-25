const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendOTPEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: `"Online Notepad" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: 'Your Login OTP - Online Notepad',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #333;">Two-Factor Authentication</h2>
                <p style="color: #555;">Use the OTP below to complete your login. It is valid for <strong>10 minutes</strong>.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
                </div>
                <p style="color: #888; font-size: 13px;">If you did not request this OTP, please ignore this email.</p>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

const sendInviteEmail = async (toEmail, inviterName, teamName, roleName) => {
    const mailOptions = {
        from: `"Online Notepad" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `You've been invited to join ${teamName} on Online Notepad`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #333;">You've been invited! 🎉</h2>
                <p style="color: #555;">
                    <strong>${inviterName}</strong> has invited you to join the team 
                    <strong>${teamName}</strong> as a <strong>${roleName}</strong>.
                </p>
                <p style="color: #555;">Log in to your Online Notepad account to get started.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${process.env.FRONTEND_URL}/login" 
                       style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                        Go to Online Notepad
                    </a>
                </div>
                <p style="color: #888; font-size: 13px;">If you did not expect this invitation, you can ignore this email.</p>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail, sendInviteEmail };