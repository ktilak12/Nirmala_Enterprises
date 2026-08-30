import { withTransaction } from '../config/db.js';
import { Enquiry } from '../models/Enquiry.js';
import { Party } from '../models/Party.js';
import { badRequest, notFound } from '../utils/errors.js';
import { writeAudit } from './audit.js';

/**
 * Public contact-form enquiries (Section 9).
 *
 * The write path here is the only one in the system reachable by an
 * unauthenticated stranger, so it is deliberately narrow: it appends to its own
 * collection, touches nothing else, and cannot reference or modify an existing
 * record. Everything a visitor submits is untrusted text awaiting a human.
 */

/** Fields a visitor may set. Anything else on the request body is ignored. */
const SUBMITTABLE = ['name', 'phone', 'email', 'village', 'enquiryType', 'message'];

export async function submitEnquiry({ payload, req }) {
  const doc = {};
  for (const field of SUBMITTABLE) {
    if (payload[field] !== undefined) doc[field] = payload[field];
  }

  doc.status = 'NEW';
  doc.ip = req?.ip ?? null;

  /**
   * No audit entry and no transaction. An audit log is a record of what staff
   * did; letting the public write to it would let anyone flood the trail that
   * exists to hold staff accountable. The enquiry row is itself the record.
   */
  const enquiry = await Enquiry.create(doc);

  /**
   * The reply is deliberately bare. Echoing the saved document back would tell a
   * prober what the server stored and retained - including the IP it recorded.
   */
  return { id: String(enquiry._id), createdAt: enquiry.createdAt };
}

const STAFF_EDITABLE = ['status', 'staffNotes'];

/**
 * Staff triage: change the status, add a note, or record which party record the
 * enquiry became.
 *
 * Conversion is two deliberate steps rather than one clever one. Staff create the
 * party through the normal party form - with its validation, its duplicate check
 * and its own audit entry - and then link it here. A one-click convert would have
 * meant a second, thinner path into the party master fed by text a stranger typed.
 */
export async function updateEnquiry({ enquiryId, payload, actor, req }) {
  return withTransaction(async (session) => {
    const enquiry = await Enquiry.findById(enquiryId).session(session);
    if (!enquiry) throw notFound('Enquiry not found.');

    const changes = [];

    for (const field of STAFF_EDITABLE) {
      const next = payload[field];
      if (next === undefined) continue;
      if (String(enquiry[field] ?? '') === String(next)) continue;
      changes.push({ field, from: enquiry[field] ?? null, to: next });
      enquiry[field] = next;
    }

    if (payload.convertedPartyId !== undefined) {
      const party = await Party.findById(payload.convertedPartyId).session(session);
      if (!party) throw badRequest('That party record does not exist.');

      changes.push({
        field: 'convertedParty',
        from: enquiry.convertedParty ? String(enquiry.convertedParty) : null,
        to: party.partyCode,
      });

      enquiry.convertedParty = party._id;
      enquiry.status = 'CONVERTED';
    }

    if (changes.length === 0) return enquiry;

    // Whoever last touched it, so an unanswered enquiry has a name against it.
    enquiry.handledBy = actor._id;
    enquiry.handledByName = actor.name;

    await enquiry.save({ session });

    await writeAudit({
      session,
      actor,
      action: 'UPDATE',
      entity: 'Enquiry',
      entityId: enquiry._id,
      entityCode: enquiry.phone,
      summary: `Enquiry from ${enquiry.name} marked ${enquiry.status}`,
      changes,
      req,
    });

    return enquiry;
  });
}
