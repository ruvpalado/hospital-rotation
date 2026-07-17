require('dotenv').config();
const { Notification } = require('../models');

const NOTIFY_MODE = process.env.NOTIFY_MODE || 'mock';

let twilioClient = null;
let sgMail = null;

if (NOTIFY_MODE === 'live') {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  if (process.env.SENDGRID_API_KEY) {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
}

/**
 * Send (or mock-send) a notification. Always persists a Notification row so the
 * Notifications Center and Notification Success/Delivery Rate KPIs have data,
 * regardless of whether live credentials are configured.
 */
async function sendNotification({ userId, channel, title, message, phone, email, relatedRotationId }) {
  let status = 'mock_sent';

  if (NOTIFY_MODE === 'live') {
    try {
      if (channel === 'sms' && twilioClient && phone) {
        await twilioClient.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to: phone });
        status = 'sent';
      } else if (channel === 'email' && sgMail && email) {
        await sgMail.send({ to: email, from: process.env.SENDGRID_FROM_EMAIL, subject: title, text: message });
        status = 'sent';
      } else {
        console.log(`[notify:mock] Missing live credentials for channel=${channel}; falling back to mock.`);
      }
    } catch (err) {
      console.error('[notify:live] Failed to send, recording as failed:', err.message);
      status = 'failed';
    }
  } else {
    console.log(`[notify:mock] (${channel}) -> user ${userId}: "${title}" — ${message}`);
  }

  return Notification.create({
    user_id: userId,
    channel,
    title,
    message,
    status,
    related_rotation_id: relatedRotationId || null,
    sent_at: new Date(),
  });
}

/** Send a "rotation change coming up" reminder 3-5 days before the block start (per spec). */
async function sendUpcomingRotationReminder(user, rotationAssignment, block) {
  const title = 'Upcoming Rotation Change';
  const message = `Hi ${user.full_name}, your next rotation (Block ${block.block_number} - ${block.name}) starts on ${block.start_date}.`;
  return sendNotification({
    userId: user.id,
    channel: 'system',
    title,
    message,
    phone: user.phone,
    email: user.email,
    relatedRotationId: rotationAssignment.id,
  });
}

module.exports = { sendNotification, sendUpcomingRotationReminder };
