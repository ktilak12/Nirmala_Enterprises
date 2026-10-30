import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SESSION_DIR = path.join(DATA_DIR, 'whatsapp_session');
const SETTINGS_FILE = path.join(DATA_DIR, 'whatsapp_settings.json');
const OUTBOX_FILE = path.join(DATA_DIR, 'whatsapp_outbox.json');

// Ensure secure directory permissions (0o700)
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
} catch (e) {
  console.warn('[WA GATEWAY] Directory init warning:', e.message);
}

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[WA GATEWAY] Failed to read settings:', e.message);
  }
  return {
    adminPhone: process.env.SUPER_ADMIN_PHONE || '',
    autoSendOnCheckout: true,
    sendCustomerBill: true,
    sendAdminAlert: true
  };
}

async function saveSettings(settings) {
  try {
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('[WA GATEWAY] Failed to save settings:', e.message);
  }
}

async function logOutbox(entry) {
  try {
    let outbox = [];
    if (fs.existsSync(OUTBOX_FILE)) {
      try {
        const content = await fs.promises.readFile(OUTBOX_FILE, 'utf8');
        outbox = JSON.parse(content);
      } catch {
        outbox = [];
      }
    }
    outbox.unshift({
      _id: 'wa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...entry
    });
    // Keep last 100 entries only to save space
    if (outbox.length > 100) outbox = outbox.slice(0, 100);
    await fs.promises.writeFile(OUTBOX_FILE, JSON.stringify(outbox, null, 2), 'utf8');
  } catch (e) {
    console.error('[WA GATEWAY] Failed to update outbox:', e.message);
  }
}

const MAX_RETRY = 10;
const MIN_DISPATCH_DELAY_MS = 2500; // Anti-spam delay between messages
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes deduplication window

class WhatsAppGatewayService {
  constructor() {
    this.sock = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR_READY, CONNECTED
    this.qrDataUrl = null;
    this.rawQr = null;
    this.lastConnectedTime = null;
    this.retryCount = 0;
    this.initPromise = null;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.recentAlerts = new Map(); // key -> timestamp for deduping
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._startSocket();
    return this.initPromise;
  }

  async _startSocket() {
    try {
      this.status = 'CONNECTING';
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: false,
        browser: ['Nirmala Enterprises ERP', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.rawQr = qr;
          this.status = 'QR_READY';
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: { dark: '#002807', light: '#ffffff' }
            });
          } catch (err) {
            console.error('[WA GATEWAY] QR generation error:', err.message);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.status = 'DISCONNECTED';
          this.qrDataUrl = null;

          if (shouldReconnect) {
            if (this.retryCount >= MAX_RETRY) {
              console.warn(`[WA GATEWAY] Max reconnection retries (${MAX_RETRY}) reached. Stopping automatic reconnection.`);
              return;
            }
            const delay = Math.min(10000, (this.retryCount + 1) * 2000);
            this.retryCount++;
            console.log(`[WA GATEWAY] Reconnecting attempt ${this.retryCount}/${MAX_RETRY} in ${delay}ms...`);
            setTimeout(() => {
              this._startSocket();
            }, delay);
          } else {
            // Logged out: clean session folder securely
            try {
              fs.rmSync(SESSION_DIR, { recursive: true, force: true });
              fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
            } catch {}
            this.retryCount = 0;
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrDataUrl = null;
          this.rawQr = null;
          this.lastConnectedTime = new Date().toISOString();
          this.retryCount = 0;
          console.log('[WA GATEWAY] WhatsApp Gateway connected successfully and ready for background notifications.');
          this._processQueue();
        }
      });

    } catch (err) {
      console.error('[WA GATEWAY] Socket initialization error:', err.message);
      this.status = 'DISCONNECTED';
      this.initPromise = null;
    }
  }

  getStatus(isSuperAdmin = false) {
    const settings = getSettings();
    const base = {
      success: true,
      status: this.status, // CONNECTED, QR_READY, CONNECTING, DISCONNECTED
      connected: this.status === 'CONNECTED',
      lastConnectedTime: this.lastConnectedTime,
      adminPhone: settings.adminPhone,
      autoSendOnCheckout: settings.autoSendOnCheckout !== false,
      queueLength: this.messageQueue.length,
    };

    // TIGHT SECURITY: Only SUPER_ADMIN gets the QR Code Data URL to prevent unauthorized pairing
    if (isSuperAdmin) {
      return {
        ...base,
        qrDataUrl: this.qrDataUrl,
      };
    }
    return {
      ...base,
      qrDataUrl: null,
    };
  }

  async getOutbox() {
    try {
      if (fs.existsSync(OUTBOX_FILE)) {
        const content = await fs.promises.readFile(OUTBOX_FILE, 'utf8');
        return JSON.parse(content);
      }
    } catch {}
    return [];
  }

  async updateSettings(newSettings) {
    const current = getSettings();
    const cleanPhone = newSettings.adminPhone ? String(newSettings.adminPhone).replace(/\D/g, '') : current.adminPhone;
    const updated = {
      ...current,
      ...newSettings,
      adminPhone: cleanPhone || current.adminPhone
    };
    await saveSettings(updated);
    return updated;
  }

  /**
   * Strict phone sanitization and validation.
   * Accepts:
   *  - 10 digits (assumed India, starting with 6, 7, 8, or 9) -> prepends 91
   *  - 12 digits (starting with 91, next digit 6-9)
   *  - 11-15 digits (international with valid country code)
   */
  formatJid(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (!clean) return null;

    if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
      clean = '91' + clean;
    } else if (clean.length === 12 && clean.startsWith('91') && /^[6-9]/.test(clean.substring(2))) {
      // Already valid 12-digit Indian number
    } else if (clean.length >= 11 && clean.length <= 15) {
      // Valid international length
    } else {
      return null; // Malformed phone number rejected
    }

    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Enqueues an outbound background message and processes with anti-spam rate limiting.
   */
  async sendBackgroundMessage(toPhone, messageText) {
    const jid = this.formatJid(toPhone);
    if (!jid) {
      await logOutbox({ to: toPhone, text: messageText, status: 'SKIPPED_INVALID_PHONE' });
      return { success: false, reason: 'Invalid or malformed phone number' };
    }

    if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
      return { success: false, reason: 'Empty message text' };
    }

    // Limit length to 4096 chars to prevent buffer overflow attacks
    const sanitizedText = messageText.slice(0, 4096).trim();

    return new Promise((resolve) => {
      this.messageQueue.push({
        jid,
        toPhone,
        text: sanitizedText,
        resolve,
        timestamp: Date.now()
      });

      // Avoid queue bloat (> 100 queued items sheds oldest)
      if (this.messageQueue.length > 100) {
        const dropped = this.messageQueue.shift();
        dropped.resolve({ success: false, reason: 'Message queue overflow, dropped' });
      }

      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        if (this.status !== 'CONNECTED' || !this.sock) {
          // If offline, drain or hold
          const item = this.messageQueue.shift();
          await logOutbox({ to: item.toPhone, text: item.text, status: 'QUEUED_OFFLINE' });
          item.resolve({ success: false, reason: 'WhatsApp Gateway not linked / offline' });
          continue;
        }

        const item = this.messageQueue.shift();
        try {
          await this.sock.sendMessage(item.jid, { text: item.text });
          await logOutbox({ to: item.toPhone, text: item.text, status: 'SENT' });
          item.resolve({ success: true });
        } catch (err) {
          console.error('[WA GATEWAY] Send error to ' + item.toPhone + ':', err.message);
          await logOutbox({ to: item.toPhone, text: item.text, status: 'FAILED', error: err.message });
          item.resolve({ success: false, error: err.message });
        }

        // Enforce anti-spam delay with slight random jitter to prevent Meta detection
        if (this.messageQueue.length > 0) {
          const jitter = Math.floor(Math.random() * 1000);
          await new Promise((r) => setTimeout(r, MIN_DISPATCH_DELAY_MS + jitter));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * High-level helper to dispatch silent bill alerts to customer and administrator.
   * Includes anti-duplicate guard so rapid double-clicking never sends duplicate alerts.
   */
  async sendSilentSaleAlerts(sale, host = 'localhost:5000', protocol = 'http') {
    const settings = getSettings();
    const adminPhone = settings.adminPhone || process.env.SUPER_ADMIN_PHONE || '';
    const invoiceCode = sale.invoiceCode || sale.saleCode || sale.invoiceNo || 'N/A';

    // Anti-duplicate check (10-minute window)
    const now = Date.now();
    const dedupKey = `sale_${invoiceCode}`;
    const lastSent = this.recentAlerts.get(dedupKey);
    if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
      console.log(`[WA GATEWAY] Skipped duplicate alert for invoice ${invoiceCode}`);
      return { success: true, reason: 'DUPLICATE_SKIPPED' };
    }
    this.recentAlerts.set(dedupKey, now);

    // Housekeeping: clean older dedup entries
    if (this.recentAlerts.size > 200) {
      for (const [k, time] of this.recentAlerts.entries()) {
        if (now - time > DEDUP_WINDOW_MS) this.recentAlerts.delete(k);
      }
    }

    const accessQuery = sale.accessKey ? `?key=${sale.accessKey}` : '';
    const invoiceUrl = `${protocol}://${host}/invoice/${invoiceCode}${accessQuery}`;

    const itemsSummary = (sale.items || [])
      .map((it, idx) => {
        const q = Number(it.quantity || it.qty || 1);
        const r = Number(it.rate !== undefined ? it.rate : (it.unitPrice !== undefined ? it.unitPrice : (it.price || 0)));
        const t = Number(it.lineTotal !== undefined ? it.lineTotal : (it.total !== undefined ? it.total : (q * r)));
        const name = it.productName || it.name || 'Agro Product';
        const unit = it.unit || 'units';
        return `${idx + 1}. *${name}*\n   ${q} ${unit} × ₹${r.toLocaleString('en-IN')} = *₹${t.toLocaleString('en-IN')}*`;
      })
      .join('\n\n');

    const grandTotal = Number(sale.grandTotal || 0);
    const amountPaid = Number(sale.amountPaid !== undefined ? sale.amountPaid : (sale.paidAmount !== undefined ? sale.paidAmount : grandTotal));
    const balanceDue = Number(sale.outstanding !== undefined ? sale.outstanding : (sale.balanceDue !== undefined ? sale.balanceDue : 0));
    const supportPhoneText = adminPhone ? `+91 ${adminPhone}` : 'Contact Store Support';

    const customerMsg = 
`🌾 *NIRMALA ENTERPRISES* 🌾
_Agro Trading & Farmer Support Hub_
━━━━━━━━━━━━━━━━━━━━━
🧾 *TAX INVOICE & PAYMENT RECEIPT*
*Invoice No:* ${invoiceCode}
*Date:* ${new Date(sale.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
*Customer:* ${sale.customerName || sale.partyName || 'Customer'}
━━━━━━━━━━━━━━━━━━━━━

📦 *PURCHASED ITEMS:*
${itemsSummary || 'Agro Inputs & Fertilizers'}

━━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ₹${sale.subtotal || 0}
*GST Tax:* ₹${sale.tax || sale.gstTotal || sale.taxTotal || 0}
💰 *GRAND TOTAL: ₹${grandTotal}*
💳 *Paid Amount:* ₹${amountPaid} (${sale.paymentMode || 'Cash'})
${balanceDue > 0 ? `⚠️ *Balance Due: ₹${balanceDue}*` : '✅ *Payment Status: Fully Paid*'}
━━━━━━━━━━━━━━━━━━━━━
📄 *Download / View Your Bill:*
${invoiceUrl}
━━━━━━━━━━━━━━━━━━━━━
🌱 _Thank you for choosing Nirmala Enterprises!_
📞 *Support Helpline:* ${supportPhoneText}
📍 Main Road, Jharigam, Nabarangpur, 764076, Odisha`;

    const adminMsg = 
`🔔 *PAYMENT RECEIVED ALERT* 🔔
*NIRMALA ENTERPRISES ERP*
━━━━━━━━━━━━━━━━━━━━━
📄 *Invoice No:* ${invoiceCode}
📅 *Date:* ${new Date(sale.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
👤 *Customer:* ${sale.customerName || sale.partyName || 'Walk-in Customer'} (${sale.customerPhone || sale.partyPhone || 'Walk-in'})
💰 *Amount Paid:* ₹${amountPaid}
💳 *Payment Mode:* ${sale.paymentMode || 'Cash'} (${sale.paymentStatus || 'PAID'})
💵 *Total Bill:* ₹${grandTotal}
⚖️ *Balance Due:* ₹${balanceDue}
━━━━━━━━━━━━━━━━━━━━━
📄 *View / Download Invoice:*
${invoiceUrl}
━━━━━━━━━━━━━━━━━━━━━
_Automated Alert to Admin_`;

    let customerResult = { success: false, reason: 'No phone' };
    const customerPhone = sale.customerPhone || sale.partyPhone;
    if (settings.sendCustomerBill !== false && customerPhone) {
      customerResult = await this.sendBackgroundMessage(customerPhone, customerMsg);
    }

    let adminResult = { success: false };
    if (settings.sendAdminAlert !== false && adminPhone) {
      adminResult = await this.sendBackgroundMessage(adminPhone, adminMsg);
    }

    return {
      success: true,
      adminPhone,
      adminSent: adminResult.success,
      customerSent: customerResult.success,
      gatewayStatus: this.status
    };
  }

  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end();
      }
    } catch {}
    this.sock = null;
    this.status = 'DISCONNECTED';
    this.qrDataUrl = null;
    this.rawQr = null;
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
    } catch {}
    this.initPromise = null;
    this.messageQueue = [];
    return { success: true, message: 'WhatsApp Gateway unlinked and credentials securely wiped.' };
  }
}

export const whatsappGateway = new WhatsAppGatewayService();
