import { Router } from 'express';
import { roleHasPermission } from '../config/permissions.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateQuery } from '../middleware/validate.js';
import { getSettings } from '../models/Setting.js';
import { writeAudit } from '../services/audit.js';
import { exportFilename, reportToCsv, reportToExcel } from '../services/exporting.js';
import { REPORTS } from '../services/reports.js';
import { asyncHandler, forbidden, notFound } from '../utils/errors.js';
import { reportQuery } from '../validators/index.js';

export const reportsRouter = Router();

/**
 * Reports (Section 33) and their exports (Section 34).
 *
 * One route serves all ten because every report returns the same envelope -
 * `{ title, period, columns, rows, totals, meta }` - so the Excel and CSV writers
 * need no knowledge of any individual report.
 */
reportsRouter.get(
  '/',
  requirePermission('reports:read'),
  asyncHandler(async (req, res) => {
    const rows = Object.entries(REPORTS)
      .filter(([, def]) => roleHasPermission(req.user.role, def.permission))
      .map(([key, def]) => ({
        key,
        label: def.label,
        description: def.description,
        financial: def.permission === 'reports:financial',
      }));

    res.json({ rows });
  }),
);

reportsRouter.get(
  '/:key',
  requirePermission('reports:read'),
  validateQuery(reportQuery),
  asyncHandler(async (req, res) => {
    /**
     * `Object.hasOwn` rather than a truthiness test: `REPORTS['constructor']`
     * resolves off Object.prototype, would pass an `if (!def)` guard, and then
     * blow up on `def.run` as a 500. An unknown report name is a 404.
     */
    if (!Object.hasOwn(REPORTS, req.params.key)) {
      throw notFound(`There is no report called "${req.params.key}".`);
    }
    const def = REPORTS[req.params.key];

    const canSeeFinancials = roleHasPermission(req.user.role, 'reports:financial');

    if (!canSeeFinancials && def.permission === 'reports:financial') {
      throw forbidden('This report contains financial information you do not have access to.', {
        required: ['reports:financial'],
      });
    }

    const { format, ...params } = req.valid.query;
    const report = await def.run(params);

    /**
     * The second gate, and the one that actually matters.
     *
     * The registry above classifies a report by its usual content, but a report
     * can change shape according to its parameters: the sales register is an
     * operational document, yet `?groupBy=product` turns it into a margin
     * analysis. Trusting the registry alone would let a sales-staff token read
     * the business's gross margin through a query string.
     *
     * So the produced report is asked what it actually contains. Anything that
     * declares `meta.financial` is refused here regardless of which key was
     * requested - a check on the output rather than on the label.
     */
    if (!canSeeFinancials && report.meta?.financial) {
      throw forbidden(
        'That combination of options produces a financial report, which you do not have ' +
          'access to. Remove the grouping to see the operational figures.',
        { required: ['reports:financial'] },
      );
    }

    if (format === 'json') {
      return res.json({ report });
    }

    if (!roleHasPermission(req.user.role, 'exports:generate')) {
      throw forbidden('You do not have permission to export reports.', {
        required: ['exports:generate'],
      });
    }

    const settings = await getSettings();
    const company = settings.company?.name ?? 'Nirmala Enterprises';

    /**
     * Exports are audited. A spreadsheet of the customer ledger leaving the
     * building is exactly the event somebody may need to account for later, and
     * the enum already carries an EXPORT action for it.
     */
    await writeAudit({
      actor: req.user,
      action: 'EXPORT',
      entity: 'Report',
      entityCode: req.params.key,
      summary: `Exported "${report.title}" (${report.period}) as ${format.toUpperCase()}`,
      req,
    }).catch(() => {});

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exportFilename(report, 'csv')}"`,
      );
      return res.send(reportToCsv(report));
    }

    const buffer = await reportToExcel(report, { company });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFilename(report, 'xlsx')}"`,
    );
    return res.send(Buffer.from(buffer));
  }),
);
