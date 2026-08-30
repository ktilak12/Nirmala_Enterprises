import { withTransaction } from '../config/db.js';
import { getSettings, Setting } from '../models/Setting.js';
import { badRequest } from '../utils/errors.js';
import { diffDocuments, writeAudit } from './audit.js';

/**
 * Business settings (Section 36).
 *
 * Two audiences, two shapes. `getPublicSettings` returns only what the
 * marketing site needs - address, phone, hours - because Section 10 is explicit
 * that the public website must not expose private financial information, and
 * the settings document also holds the GSTIN and the lending configuration.
 */

const SECTIONS = ['company', 'tax', 'invoice', 'inventory', 'lending'];

export async function readSettings() {
  return getSettings();
}

export async function getPublicSettings() {
  const s = await getSettings();
  return {
    company: {
      name: s.company.name,
      tagline: s.company.tagline,
      address: s.company.address,
      phone: s.company.phone,
      whatsapp: s.company.whatsapp,
      email: s.company.email,
      businessHours: s.company.businessHours,
      mapEmbedUrl: s.company.mapEmbedUrl,
    },
  };
}

export async function updateSettings({ payload, actor, req }) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const before = settings.toObject();

    for (const section of SECTIONS) {
      if (payload[section] === undefined) continue;
      if (typeof payload[section] !== 'object' || payload[section] === null) {
        throw badRequest(`${section} settings must be an object.`);
      }
      settings[section] = { ...settings[section].toObject?.() ?? settings[section], ...payload[section] };
    }

    /**
     * Turning tax on without a GSTIN would print an invoice claiming tax was
     * charged by an unregistered business. Refuse it rather than produce a
     * document nobody can defend.
     */
    if (settings.tax.enabled && !settings.tax.gstin?.trim()) {
      throw badRequest(
        'Enter the GSTIN before enabling tax - a tax invoice without a registration ' +
          'number is not valid.',
      );
    }

    settings.updatedBy = actor._id;

    const changes = diffDocuments(before, settings.toObject(), {
      include: new Set(SECTIONS),
    });

    await settings.save({ session });

    if (changes.length > 0) {
      await writeAudit({
        session,
        actor,
        action: 'UPDATE',
        entity: 'Setting',
        entityId: settings._id,
        entityCode: 'GLOBAL',
        summary: `Updated ${changes.map((c) => c.field).join(', ')} settings`,
        changes,
        req,
      });
    }

    return settings;
  });
}

export { Setting };
