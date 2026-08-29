import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ENV } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { customerRoutes } from './modules/customers/customers.routes';
import { measurementRoutes } from './modules/measurements/measurements.routes';
import { productRoutes } from './modules/products/products.routes';
import { orderRoutes } from './modules/orders/orders.routes';
import { productionRoutes } from './modules/production/production.routes';
import { qcRoutes } from './modules/qc/qc.routes';
import { inventoryRoutes } from './modules/inventory/inventory.routes';
import { workerRoutes } from './modules/workers/workers.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { paymentRoutes } from './modules/payments/payments.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { purchaseRoutes } from './modules/purchases/purchases.routes';
import { dispatchRoutes } from './modules/dispatch/dispatch.routes';
import { reportRoutes } from './modules/reports/reports.routes';
import { searchRoutes } from './modules/search/search.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { importRoutes } from './modules/imports-exports/imports.routes';
import { exportRoutes } from './modules/imports-exports/exports.routes';
import { whatsappRoutes } from './modules/notifications/whatsapp.routes';
import { googleRoutes } from './modules/integrations/google.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import productionFactoryRoutes from './modules/production-factory/production-factory.routes';
import { generateWhatsAppMessage } from './modules/notifications/whatsapp.service';

const app = express();

// Middlewares
app.use(cors({ origin: ENV.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Tailor & Garment Manufacturing CRM Backend',
    timestamp: new Date().toISOString()
  });
});

// WhatsApp Link Generator Utility
app.post('/api/notifications/whatsapp-link', (req: Request, res: Response) => {
  const result = generateWhatsAppMessage(req.body);
  res.json(result);
});

// Module API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/factory', productionFactoryRoutes);

// Error handling middleware
app.use(errorHandler);

const PORT = ENV.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Tailor CRM Backend running on http://localhost:${PORT}`);
});

export default app;
