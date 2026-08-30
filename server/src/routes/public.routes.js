import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Category } from '../models/Catalog.js';
import { Product } from '../models/Product.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { submitEnquiry } from '../services/enquiries.js';
import { getPublicSettings } from '../services/settings.js';
import { asyncHandler } from '../utils/errors.js';
import { contactSchema, publicProductsQuery } from '../validators/index.js';

export const publicRouter = Router();

/**
 * The marketing website's data (Sections 5 to 10).
 *
 * Section 10: "The public website should not expose private financial
 * information." This router is the boundary where that rule is kept, so every
 * response below is assembled from an explicit allow-list of fields rather than
 * by removing the sensitive ones from a full document. The difference matters:
 * with an allow-list, a field added to the Product schema next year is invisible
 * here by default. With a deny-list, it would be published until somebody
 * remembered to exclude it.
 *
 * Nothing here is authenticated, so nothing here may reveal stock quantities,
 * cost, margin, a customer name, or a farmer's balance.
 */

/**
 * The contact form is unauthenticated and writes to the database, so it gets a
 * far tighter limit than the general API. Five an hour per address is more than
 * any genuine visitor needs and makes the form useless for flooding.
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many messages sent from this connection. Please telephone us instead.',
  },
});

/** Shop address, phone and hours - what the Contact page and footer need. */
publicRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(await getPublicSettings());
  }),
);

/**
 * The catalogue for the "Our Products" and "Agricultural Inputs" pages, driven by
 * the real product master so the website cannot drift from what the shop sells.
 *
 * No prices. Agricultural input prices move with the season and the supplier, and
 * a stale figure on a public page is a promise the counter then has to break.
 * Stock is published as a plain in-stock flag rather than a quantity - a visitor
 * needs to know whether to make the trip, not how thin the business is running.
 */
publicRouter.get(
  '/products',
  validateQuery(publicProductsQuery),
  asyncHandler(async (req, res) => {
    const { category, kind } = req.valid.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (kind === 'commodity') filter.isCommodity = true;
    if (kind === 'inputs') filter.isCommodity = false;

    const [products, categories] = await Promise.all([
      Product.find(filter)
        .select('name brand description isCommodity currentStock category unit')
        .populate('category', 'name kind')
        .populate('unit', 'symbol')
        .sort('name')
        .lean(),
      Category.find({ isActive: true }).select('name kind').sort('name').lean(),
    ]);

    res.json({
      rows: products.map((p) => ({
        name: p.name,
        brand: p.brand ?? '',
        description: p.description ?? '',
        category: p.category?.name ?? '',
        categoryKind: p.category?.kind ?? 'OTHER',
        unit: p.unit?.symbol ?? '',
        isCommodity: Boolean(p.isCommodity),
        inStock: Number(p.currentStock ?? 0) > 0,
      })),
      categories: categories.map((c) => ({
        id: String(c._id),
        name: c.name,
        kind: c.kind,
      })),
    });
  }),
);

/**
 * The Contact Us form (Section 9).
 *
 * Lands in the `enquiries` collection, never in the party master. An open
 * endpoint that could create a farmer record would let anyone on the internet
 * fill the master list with junk, so an enquiry waits here until a member of
 * staff decides to act on it.
 */
publicRouter.post(
  '/contact',
  contactLimiter,
  validate(contactSchema),
  asyncHandler(async (req, res) => {
    await submitEnquiry({ payload: req.valid.body, req });

    res.status(201).json({
      message: 'Thank you. We have your message and will be in touch shortly.',
    });
  }),
);
