import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { ENV } from '../../config/env';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  companyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(6),
  branchName: z.string().default('Main Branch'),
  currency: z.string().default('INR'),
  businessType: z.enum(['TAILOR_SHOP', 'GARMENT_FACTORY', 'HYBRID']).default('HYBRID')
});

const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1)
});

// Register new SaaS Company + Owner + Main Branch + Default Measurement Templates
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug,
          phone: data.phone,
          email: data.email,
          currency: data.currency,
          businessType: data.businessType
        }
      });

      // 2. Create Main Branch
      const branch = await tx.branch.create({
        data: {
          companyId: company.id,
          name: data.branchName,
          code: 'MAIN-01',
          phone: data.phone,
          isMain: true
        }
      });

      // 3. Create Owner User
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          name: data.ownerName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: 'OWNER'
        }
      });

      // 4. Create standard default measurement templates for convenience
      const templates = [
        {
          companyId: company.id,
          name: "Men's Formal Shirt",
          gender: "MEN",
          category: "Tops",
          fieldsJson: JSON.stringify([
            { key: "chest", label: "Chest (inches)", placeholder: "40", unit: "inch" },
            { key: "waist", label: "Waist (inches)", placeholder: "36", unit: "inch" },
            { key: "shoulder", label: "Shoulder (inches)", placeholder: "18", unit: "inch" },
            { key: "sleeve", label: "Sleeve Length", placeholder: "25", unit: "inch" },
            { key: "neck", label: "Collar / Neck", placeholder: "16", unit: "inch" },
            { key: "length", label: "Shirt Length", placeholder: "29", unit: "inch" },
            { key: "cuff", label: "Cuff Size", placeholder: "9.5", unit: "inch" }
          ]),
          isDefault: true
        },
        {
          companyId: company.id,
          name: "Men's Trousers / Pant",
          gender: "MEN",
          category: "Bottoms",
          fieldsJson: JSON.stringify([
            { key: "waist", label: "Waist", placeholder: "34", unit: "inch" },
            { key: "hip", label: "Seat / Hip", placeholder: "40", unit: "inch" },
            { key: "length", label: "Outseam / Full Length", placeholder: "41", unit: "inch" },
            { key: "inseam", label: "Inseam", placeholder: "31", unit: "inch" },
            { key: "thigh", label: "Thigh", placeholder: "24", unit: "inch" },
            { key: "knee", label: "Knee", placeholder: "18", unit: "inch" },
            { key: "bottom", label: "Bottom / Opening", placeholder: "14", unit: "inch" }
          ]),
          isDefault: true
        },
        {
          companyId: company.id,
          name: "Women's Kurti / Kameez",
          gender: "WOMEN",
          category: "Ethnic",
          fieldsJson: JSON.stringify([
            { key: "bust", label: "Bust", placeholder: "36", unit: "inch" },
            { key: "waist", label: "Waist", placeholder: "30", unit: "inch" },
            { key: "hip", label: "Hip", placeholder: "38", unit: "inch" },
            { key: "shoulder", label: "Shoulder", placeholder: "14.5", unit: "inch" },
            { key: "sleeve_length", label: "Sleeve Length", placeholder: "16", unit: "inch" },
            { key: "sleeve_round", label: "Armhole / Bicep", placeholder: "12", unit: "inch" },
            { key: "kurti_length", label: "Full Length", placeholder: "42", unit: "inch" },
            { key: "neck_front", label: "Front Neck Depth", placeholder: "6.5", unit: "inch" },
            { key: "neck_back", label: "Back Neck Depth", placeholder: "5", unit: "inch" }
          ]),
          isDefault: true
        },
        {
          companyId: company.id,
          name: "Women's Blouse",
          gender: "WOMEN",
          category: "Ethnic",
          fieldsJson: JSON.stringify([
            { key: "chest", label: "Chest / Upper Bust", placeholder: "36", unit: "inch" },
            { key: "bust", label: "Full Bust", placeholder: "37", unit: "inch" },
            { key: "underbust", label: "Underbust / Waist", placeholder: "30", unit: "inch" },
            { key: "blouse_length", label: "Blouse Length", placeholder: "14", unit: "inch" },
            { key: "shoulder", label: "Shoulder", placeholder: "14", unit: "inch" },
            { key: "sleeve_length", label: "Sleeve Length", placeholder: "9", unit: "inch" },
            { key: "armhole", label: "Armhole", placeholder: "15", unit: "inch" }
          ]),
          isDefault: true
        }
      ];

      for (const t of templates) {
        await tx.measurementTemplate.create({ data: t });
      }

      return { company, branch, user };
    });

    const token = jwt.sign(
      { userId: result.user.id, companyId: result.company.id, role: result.user.role },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Company registered successfully',
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
        companyId: result.company.id,
        companyName: result.company.name,
        branchId: result.branch.id,
        branchName: result.branch.name
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login (Email or Phone)
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.identifier }, { phone: data.identifier }]
      },
      include: {
        company: true,
        branch: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, companyId: user.companyId, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name,
        branchId: user.branchId || user.branch?.id,
        branchName: user.branch?.name
      }
    });
  } catch (error) {
    next(error);
  }
});

// Current Authenticated User & Profile
router.get('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        company: {
          include: {
            branches: true
          }
        },
        branch: true
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        company: user.company,
        currentBranch: user.branch || user.company.branches[0],
        allBranches: user.company.branches
      }
    });
  } catch (error) {
    next(error);
  }
});

export const authRoutes = router;
