import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import * as z from 'zod';
import { optionalAuth } from './lib/auth.js';
import { HttpError, errorBody } from './lib/errors.js';
import { validationError } from './lib/validate.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin/index.js';
import authRoutes from './routes/auth.js';
import buildsRoutes from './routes/builds.js';
import cartRoutes from './routes/cart.js';
import catalogRoutes from './routes/catalog.js';
import inboundRoutes from './routes/inbound.js';
import kitsRoutes from './routes/kits.js';
import ordersRoutes from './routes/orders.js';
import paymentsRoutes from './routes/payments.js';
import reportsRoutes from './routes/reports.js';
import seoRoutes from './routes/seo.js';
import settingsRoutes from './routes/settings.js';
import studioRoutes from './routes/studio.js';

const WEBHOOK_PATH = '/api/payments/razorpay/webhook';

const nothingHere = () => new HttpError(404, 'not_found', 'There is nothing at this address.');

const STATUS_CODES = { 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 429: 'rate_limited' };
const STATUS_MESSAGES = {
  401: 'Sign in to continue.',
  403: 'You do not have access to this.',
  404: 'Not found.',
  413: 'That request is too large.',
  415: 'That kind of content is not accepted here.',
};

// Works out the status and ApiErrorBody for anything a route can throw, or null for the unexpected.
function describeError(thrown) {
  // A route that called schema.parse() itself instead of lib/validate.js parse().
  const err = thrown instanceof z.ZodError ? validationError(thrown.issues) : thrown;

  if (err instanceof HttpError) return { status: err.status, body: errorBody(err.code, err.message, err.fields) };

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'That upload has too many files or an unexpected field.';
    return { status: 400, body: errorBody('validation_error', message) };
  }

  if (err?.type === 'entity.parse.failed') {
    return { status: 400, body: errorBody('validation_error', 'The request body is not valid JSON.') };
  }

  // Errors raised by Express and its body parsers and static server carry a 4xx status.
  // Their own messages can mention internals, so only the status is reused.
  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return {
      status,
      body: errorBody(STATUS_CODES[status] ?? 'validation_error', STATUS_MESSAGES[status] ?? 'That request could not be understood.'),
    };
  }

  return null;
}

/** The single error handler: every failure leaves as ApiErrorBody, and nothing internal leaks. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const known = describeError(err);
  if (known) return res.status(known.status).json(known.body);

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json(errorBody('server_error', 'Something went wrong on our side. Please try again.'));
}

/** Builds the Express app around a context from createContext(). It does not listen. */
export function createApp(ctx) {
  const { config } = ctx;
  const app = express();

  // lib/auth.js reads the context from here, which is why its middlewares take no arguments.
  app.locals.ctx = ctx;
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://checkout.razorpay.com', 'https://cdn.razorpay.com'],
          'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://lumberjack-cx.razorpay.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://*.razorpay.com'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'worker-src': ["'self'", 'blob:'],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: config.isProd,
    }),
  );
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(cookieParser());

  // Razorpay signs the exact bytes it sent, so this one route keeps its body as a Buffer.
  // express.json() below then skips it because the stream has already been read.
  app.use(WEBHOOK_PATH, express.raw({ type: () => true, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/uploads',
    express.static(config.uploadsDir, { index: false, maxAge: '1y', immutable: true, fallthrough: false }),
  );

  // API answers depend on the cookie and on live stock and prices: nothing may cache them.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Every API route can rely on req.user being the signed-in users row or null.
  app.use('/api', optionalAuth);

  app.use('/api', settingsRoutes(ctx));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/account', accountRoutes(ctx));
  app.use('/api', catalogRoutes(ctx));
  app.use('/api', reportsRoutes(ctx));
  app.use('/api', inboundRoutes(ctx));
  app.use('/api', cartRoutes(ctx));
  app.use('/api/orders', ordersRoutes(ctx));
  app.use('/api/studio', studioRoutes(ctx));
  app.use('/api/payments', paymentsRoutes(ctx));
  app.use('/api/kits', kitsRoutes(ctx));
  app.use('/api/builds', buildsRoutes(ctx));
  app.use('/api/admin', adminRoutes(ctx));

  app.use('/api', (req, res, next) => next(nothingHere()));

  app.use('/', seoRoutes(ctx));

  app.use((req, res, next) => next(nothingHere()));
  app.use(errorHandler);

  return app;
}
