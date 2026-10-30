import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ROLES } from '../config/permissions.js';
import { requireRole } from '../middleware/rbac.js';
import { whatsappGateway } from '../services/whatsappGateway.js';

export const whatsappRouter = Router();

// Strict rate-limiter for WhatsApp test endpoint: max 3 test requests per 10 minutes per IP
const whatsappTestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many WhatsApp test requests. Please wait 10 minutes before trying again.',
  },
});

/**
 * WhatsApp Gateway Status.
 * Anyone authenticated can see if the gateway is CONNECTED or DISCONNECTED.
 * BUT the sensitive QR code (which gives full account access) is ONLY delivered to SUPER_ADMIN.
 */
whatsappRouter.get('/status', (req, res) => {
  const isSuperAdmin = req.user?.role === ROLES.SUPER_ADMIN;
  const status = whatsappGateway.getStatus(isSuperAdmin);
  return res.json(status);
});

/**
 * Update WhatsApp Notification Settings.
 * SUPER_ADMIN only.
 */
whatsappRouter.post('/settings', requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
  const updated = await whatsappGateway.updateSettings(req.body);
  return res.json({
    success: true,
    settings: updated,
    message: 'WhatsApp Gateway settings updated successfully.',
  });
});

/**
 * Disconnect and Wipe Active WhatsApp Session.
 * SUPER_ADMIN only.
 */
whatsappRouter.post('/disconnect', requireRole(ROLES.SUPER_ADMIN), async (_req, res) => {
  const result = await whatsappGateway.disconnect();
  return res.json(result);
});

/**
 * View Outbound WhatsApp Notification Audit Logs.
 * SUPER_ADMIN only.
 */
whatsappRouter.get('/outbox', requireRole(ROLES.SUPER_ADMIN), async (_req, res) => {
  const outbox = await whatsappGateway.getOutbox();
  return res.json({ success: true, data: outbox });
});

/**
 * Test WhatsApp Connectivity.
 * SUPER_ADMIN only. Strictly constrained to sending to verified Super Admin phone.
 */
whatsappRouter.post('/test', requireRole(ROLES.SUPER_ADMIN), whatsappTestLimiter, async (_req, res) => {
  const status = whatsappGateway.getStatus(true);
  const targetPhone = status.adminPhone || process.env.SUPER_ADMIN_PHONE;

  if (!targetPhone) {
    return res.status(400).json({
      success: false,
      message: 'No administrator phone configured. Please configure an admin phone number in settings.',
    });
  }

  const testMsg = `🌾 *NIRMALA ENTERPRISES ERP* 🌾
━━━━━━━━━━━━━━━━━━━━━
✅ *WhatsApp Gateway Test Message*
Connected device verified.
Time: ${new Date().toLocaleTimeString('en-IN')}
Super Admin: ${targetPhone}
━━━━━━━━━━━━━━━━━━━━━
_Automated Background Gateway Active_`;

  const result = await whatsappGateway.sendBackgroundMessage(targetPhone, testMsg);
  return res.json({ success: result.success, result, targetPhone });
});

