import { z } from 'zod';
import {
  UserRole,
  CustomerType,
  GenderCategory,
  OrderType,
  OrderStatus,
  ProductionStage,
  QCStatus,
  DefectType,
  InventoryCategory,
  StockMovementType,
  PaymentMethod,
  PaymentStatus,
  WageType,
  PriorityLevel
} from './enums';

// Auth Schemas
export const RegisterTenantSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  branchName: z.string().default('Main Branch'),
  currency: z.string().default('INR'),
  businessType: z.enum(['TAILOR_SHOP', 'GARMENT_FACTORY', 'HYBRID']).default('HYBRID')
});

export type RegisterTenantDto = z.infer<typeof RegisterTenantSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone required'),
  password: z.string().min(1, 'Password required')
});

export type LoginDto = z.infer<typeof LoginSchema>;

// Customer Schema
export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  businessName: z.string().optional().nullable(),
  phone: z.string().min(10, 'Valid phone required'),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([])
});

export type CustomerDto = z.infer<typeof CustomerSchema>;

// Measurement Data Schema
export const MeasurementValuesSchema = z.record(z.string(), z.number().or(z.string()));

export const CreateMeasurementSchema = z.object({
  customerId: z.string().uuid(),
  templateId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Measurement title required (e.g. 2-Piece Suit, Kurti)'),
  gender: z.nativeEnum(GenderCategory).default(GenderCategory.MEN),
  values: MeasurementValuesSchema,
  unit: z.enum(['INCH', 'CM']).default('INCH'),
  specialInstructions: z.string().optional().nullable(),
  referenceImages: z.array(z.string()).default([])
});

export type CreateMeasurementDto = z.infer<typeof CreateMeasurementSchema>;

// Product / Style & BOM Schemas
export const BOMItemInputSchema = z.object({
  materialName: z.string().min(1),
  inventoryItemId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  wastagePercentage: z.number().min(0).default(0),
  costPerUnit: z.number().min(0).default(0)
});

export const CreateProductStyleSchema = z.object({
  styleNumber: z.string().min(1, 'Style SKU/Number is required'),
  name: z.string().min(1, 'Product style name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  fabricDetails: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  gender: z.nativeEnum(GenderCategory).default(GenderCategory.MEN),
  sizeRange: z.array(z.string()).default([]),
  colorRange: z.array(z.string()).default([]),
  sellingPrice: z.number().min(0).default(0),
  estimatedCost: z.number().min(0).default(0),
  standardProdMinutes: z.number().min(0).default(60),
  bom: z.array(BOMItemInputSchema).default([])
});

export type CreateProductStyleDto = z.infer<typeof CreateProductStyleSchema>;

// Order Schemas
export const OrderItemInputSchema = z.object({
  productStyleId: z.string().uuid().optional().nullable(),
  customItemName: z.string().min(1),
  itemType: z.nativeEnum(OrderType).default(OrderType.BESPOKE_TAILORING),
  gender: z.nativeEnum(GenderCategory).default(GenderCategory.MEN),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().min(0),
  measurementId: z.string().uuid().optional().nullable(),
  fabricProvidedByCustomer: z.boolean().default(false),
  fabricDetails: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  designNotes: z.string().optional().nullable(),
  referenceImages: z.array(z.string()).default([])
});

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  orderType: z.nativeEnum(OrderType).default(OrderType.BESPOKE_TAILORING),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.NORMAL),
  trialDate: z.string().optional().nullable(),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  items: z.array(OrderItemInputSchema).min(1, 'At least 1 item is required'),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  advancePaid: z.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  notes: z.string().optional().nullable()
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

// QC Log Schema
export const CreateQCLogSchema = z.object({
  jobCardId: z.string().uuid(),
  status: z.nativeEnum(QCStatus),
  defectType: z.nativeEnum(DefectType).optional().nullable(),
  defectNotes: z.string().optional().nullable(),
  defectPhotos: z.array(z.string()).default([]),
  reworkAssignedToWorkerId: z.string().uuid().optional().nullable()
});

export type CreateQCLogDto = z.infer<typeof CreateQCLogSchema>;

// Worker & Piece Rate Log
export const PieceRateLogSchema = z.object({
  workerId: z.string().uuid(),
  jobCardId: z.string().uuid().optional().nullable(),
  stage: z.nativeEnum(ProductionStage),
  quantity: z.number().int().positive(),
  ratePerPiece: z.number().min(0),
  notes: z.string().optional().nullable()
});

export type PieceRateLogDto = z.infer<typeof PieceRateLogSchema>;

// Inventory Item Schema
export const InventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name required'),
  sku: z.string().optional().nullable(),
  category: z.nativeEnum(InventoryCategory),
  unit: z.string().min(1, 'Unit (e.g. meter, pcs, kg) required'),
  currentStock: z.number().min(0).default(0),
  minStockAlert: z.number().min(0).default(10),
  unitCost: z.number().min(0).default(0),
  supplierName: z.string().optional().nullable(),
  location: z.string().optional().nullable()
});

export type InventoryItemDto = z.infer<typeof InventoryItemSchema>;
