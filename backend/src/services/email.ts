import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendAppointmentReminder(
  to: string,
  userName: string,
  petName: string,
  title: string,
  appointmentAt: Date,
  veterinarian: string | null,
  location: string | null
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP not configured, skipping reminder email");
    return false;
  }

  const formattedDate = appointmentAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const details = [
    veterinarian ? `Veterinarian: ${veterinarian}` : null,
    location ? `Location: ${location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@petinfo.local",
    to,
    subject: `Reminder: ${petName}'s appointment tomorrow — ${title}`,
    text: `Hi ${userName},

This is a reminder that ${petName} has a veterinary appointment scheduled for tomorrow:

${title}
Date: ${formattedDate}
${details}

Pet Information App`,
  });

  return true;
}
