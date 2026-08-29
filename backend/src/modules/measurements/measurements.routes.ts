import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const MeasurementTemplateSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).default('MEN'),
  category: z.string().default('General'),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    placeholder: z.string().optional(),
    unit: z.string().default('inch')
  }))
});

const CustomerMeasurementSchema = z.object({
  customerId: z.string(),
  templateId: z.string().optional().nullable(),
  title: z.string().min(1),
  gender: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).default('MEN'),
  unit: z.enum(['INCH', 'CM']).default('INCH'),
  values: z.record(z.string(), z.any()),
  specialInstructions: z.string().optional().nullable(),
  referenceImages: z.array(z.string()).default([])
});

router.use(authenticateJWT);

// List all Measurement Templates (system defaults + company custom)
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gender } = req.query;
    const where: any = { companyId: req.companyId! };
    if (gender) where.gender = String(gender);

    const templates = await prisma.measurementTemplate.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const parsed = templates.map(t => ({
      ...t,
      fields: JSON.parse(t.fieldsJson || '[]')
    }));

    return res.json({ data: parsed });
  } catch (error) {
    next(error);
  }
});

// Create new Measurement Template
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = MeasurementTemplateSchema.parse(req.body);

    const template = await prisma.measurementTemplate.create({
      data: {
        companyId: req.companyId!,
        name: data.name,
        gender: data.gender,
        category: data.category,
        fieldsJson: JSON.stringify(data.fields)
      }
    });

    return res.status(201).json({
      message: 'Template created',
      template: {
        ...template,
        fields: data.fields
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get measurements of a specific customer
router.get('/customer/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const measurements = await prisma.customerMeasurement.findMany({
      where: {
        customerId: req.params.customerId,
        companyId: req.companyId!
      },
      include: {
        template: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const parsed = measurements.map(m => ({
      ...m,
      values: JSON.parse(m.valuesJson || '{}'),
      referenceImages: JSON.parse(m.referenceImagesJson || '[]'),
      templateFields: m.template ? JSON.parse(m.template.fieldsJson || '[]') : []
    }));

    return res.json({ data: parsed });
  } catch (error) {
    next(error);
  }
});

// Create / Save Customer Measurement
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CustomerMeasurementSchema.parse(req.body);

    // Check existing count to calculate version
    const count = await prisma.customerMeasurement.count({
      where: {
        customerId: data.customerId,
        companyId: req.companyId!,
        title: data.title
      }
    });

    const measurement = await prisma.customerMeasurement.create({
      data: {
        companyId: req.companyId!,
        customerId: data.customerId,
        templateId: data.templateId || null,
        title: data.title,
        gender: data.gender,
        unit: data.unit,
        valuesJson: JSON.stringify(data.values),
        specialInstructions: data.specialInstructions,
        referenceImagesJson: JSON.stringify(data.referenceImages),
        version: count + 1
      }
    });

    return res.status(201).json({
      message: 'Measurement saved successfully',
      measurement: {
        ...measurement,
        values: data.values,
        referenceImages: data.referenceImages
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single measurement by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const measurement = await prisma.customerMeasurement.findFirst({
      where: {
        id: req.params.id,
        companyId: req.companyId!
      },
      include: {
        customer: true,
        template: true
      }
    });

    if (!measurement) return res.status(404).json({ error: 'Measurement not found' });

    return res.json({
      measurement: {
        ...measurement,
        values: JSON.parse(measurement.valuesJson || '{}'),
        referenceImages: JSON.parse(measurement.referenceImagesJson || '[]')
      }
    });
  } catch (error) {
    next(error);
  }
});

export const measurementRoutes = router;
