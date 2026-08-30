import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { auditRouter } from './audit.routes.js';
import { authRouter } from './auth.routes.js';
import { catalogRouter } from './catalog.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { enquiriesRouter } from './enquiries.routes.js';
import { expensesRouter } from './expenses.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { invoicesRouter } from './invoices.routes.js';
import { loansRouter } from './loans.routes.js';
import { partiesRouter } from './parties.routes.js';
import { paymentsRouter } from './payments.routes.js';
import { productsRouter } from './products.routes.js';
import { publicRouter } from './public.routes.js';
import { purchasesRouter } from './purchases.routes.js';
import { reportsRouter } from './reports.routes.js';
import { salesRouter } from './sales.routes.js';
import { searchRouter } from './search.routes.js';
import { settingsRouter } from './settings.routes.js';
import { usersRouter } from './users.routes.js';

export const apiRouter = Router();

/**
 * Public, unauthenticated surface. Deliberately tiny: the marketing site needs
 * the shop address and a contact form, and nothing else. Section 10 requires
 * that no private financial information be reachable without signing in, so
 * everything below the `authenticate` line is gated.
 */
apiRouter.use('/public', publicRouter);
apiRouter.use('/auth', authRouter);

apiRouter.use(authenticate);

apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/parties', partiesRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/sales', salesRouter);
apiRouter.use('/purchases', purchasesRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/loans', loansRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/enquiries', enquiriesRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/audit', auditRouter);
