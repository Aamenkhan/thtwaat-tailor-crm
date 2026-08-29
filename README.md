# 🧵 THTWAAT — Production-Ready Tailor CRM + Garment Manufacturing SaaS

A complete multi-tenant SaaS solution tailored for **Boutiques / Custom Tailors** and **Garment Manufacturing Factories**. Built with **React Native (Expo Router + TypeScript)** on mobile and **Node.js + Prisma ORM + PostgreSQL/SQLite** on backend.

---

## 🚀 Quick Start Guide

### 1. Start the Backend API
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed    # Populates sample boutique, factory, measurements, orders & workers
npm run dev            # Starts REST API on http://localhost:5000
```

### 2. Start the Mobile App (Expo)
```bash
cd mobile
npm install
npm start              # Launches Expo Dev Server
```
- Press `w` to view in Web Browser
- Press `a` for Android Emulator
- Press `i` for iOS Simulator
- Scan QR code with Expo Go app on physical phone

---

## 🔑 Demo Login Credentials
| Role | Email | Password |
|---|---|---|
| **Owner / Master Tailor** | `owner@royalstitch.com` | `password123` |
| **Factory / Production Manager** | `production@royalstitch.com` | `password123` |

*Note: The login screen also features 1-tap quick login buttons.*

---

## 📦 System Architecture & Features

### 1. Multi-Tenant Core & RBAC
- Tenant hierarchy: `Company ➔ Branch ➔ Staff ➔ Customers ➔ Orders ➔ Production ➔ Inventory ➔ Ledger`.
- 10 Granular Roles: `OWNER`, `ADMIN`, `MANAGER`, `SALES`, `TAILOR`, `CUTTER`, `PRODUCTION_MANAGER`, `QC`, `STORE_MANAGER`, `ACCOUNTANT`.

### 2. Customer CRM & WhatsApp Direct
- Customer profiles for Individuals, Tailor Clients, Boutiques, and Wholesale Brands.
- 1-Tap direct WhatsApp message generator for Order Confirmations, Fitting receipts, Ready for Pickup, and Bills.

### 3. Measurement Studio & Custom Templates
- Dynamic body measurement templates for **Men's**, **Women's**, and **Kids'** wear.
- Body parameters: Chest, Waist, Hip, Shoulder, Sleeve, Neck, Armhole, Outseam, Inseam, Thigh, Knee, Bottom.
- Measurement versioning and fitting history per customer.

### 4. Products, Styles & BOM (Bill of Materials)
- Style catalog with SKUs, Color/Size variations, and design photos.
- Automatic material costing based on BOM (fabrics, buttons, zippers, trims) with wastage factor calculation.

### 5. Production Pipeline & Job Card Kanban
- 5-Stage production tracker: `Cutting ➔ Stitching ➔ Finishing ➔ QC ➔ Packing`.
- Job cards with QR code generation.
- Instant stage progression via in-app QR scanner.

### 6. Quality Control (QC) & Defect Logger
- 1-Tap **Pass**, **Rework**, or **Reject**.
- Defect taxonomy: Stitching flaw, measurement deviation, fabric damage, stain, trim flaw.
- Auto re-assignment of rework jobs to responsible tailor.

### 7. Raw Materials, Trims & Inventory
- Fabric rolls, trims, buttons, zippers, threads, labels.
- Automated stock-in/out tracking with stock movement audit logs.
- Real-time Low-Stock Alert warnings on dashboard.

### 8. Worker Wages & Piece-Rate Payroll
- Real-time output logging per artisan (e.g. Master Cutter cut 50 shirts @ ₹40/pc, Tailor stitched 10 kurtas @ ₹250/pc).
- Automated tracking of earned vs unpaid piece-rate wage balances.

### 9. Tax Invoices, GST Billing & PDF Generation
- GST compliant invoices with CGST/SGST/IGST breakdown.
- Dynamic PDF generation with business logo, item details, and UPI QR code.

### 10. Purchases, Dispatch Logistics & Global Search
- Supplier management and Purchase Orders with automatic Inventory intake on Goods Received.
- Packaging dimensions, box weight, courier tracking numbers, and delivery status.
- Global instant search across Orders, Customers, SKUs, and Invoices.
