import { prisma } from '../../config/db';
import { AuditService } from '../audit/audit.service';

export interface CreateExpenseInput {
  category: string;
  title: string;
  description?: string;
  amount: number;
  gstRate?: number; // e.g. 5, 12, 18, 28
  hsnCode?: string;
  paymentMethod?: string;
  payeeVendor?: string;
  receiptPhotoUrl?: string;
  expenseDate?: Date | string;
  status?: string;
  branchId?: string;
}

export class ExpenseService {
  // 1. Log a new business/factory expense
  static async createExpense(companyId: string, input: CreateExpenseInput, userId?: string) {
    if (!input.title || !input.amount || input.amount <= 0) {
      throw new Error('Expense title and positive amount are required');
    }

    const expCount = await prisma.expense.count({ where: { companyId } });
    const expNum = `EXP-${(expCount + 1).toString().padStart(5, '0')}`;

    const rate = input.gstRate || 0;
    // Calculate GST component if rate > 0 (inclusive or added)
    // Here rate is added: GST = amount * (rate / (100 + rate)) if inclusive or amount * (rate / 100)
    const gstPaid = rate > 0 ? Number(((input.amount * rate) / (100 + rate)).toFixed(2)) : 0;

    const expense = await prisma.expense.create({
      data: {
        companyId,
        branchId: input.branchId,
        expenseNumber: expNum,
        category: input.category || 'OTHER',
        title: input.title,
        description: input.description,
        amount: input.amount,
        gstRate: rate,
        gstPaid,
        hsnCode: input.hsnCode,
        paymentMethod: input.paymentMethod || 'CASH',
        payeeVendor: input.payeeVendor,
        receiptPhotoUrl: input.receiptPhotoUrl,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
        status: input.status || 'PAID',
        recordedById: userId
      }
    });

    await AuditService.log({
      companyId,
      userId,
      action: 'EXPENSE_LOGGED',
      entityType: 'EXPENSE',
      recordId: expense.id,
      details: {
        expenseNumber: expNum,
        category: expense.category,
        amount: expense.amount,
        gstPaid: expense.gstPaid
      }
    });

    return expense;
  }

  // 2. Query expenses with filters
  static async getExpenses(
    companyId: string,
    filters: {
      category?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      paymentMethod?: string;
    } = {}
  ) {
    const where: any = { companyId };

    if (filters.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }
    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      where.paymentMethod = filters.paymentMethod;
    }
    if (filters.startDate || filters.endDate) {
      where.expenseDate = {};
      if (filters.startDate) where.expenseDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.expenseDate.lte = new Date(filters.endDate);
    }
    if (filters.search) {
      const q = filters.search;
      where.OR = [
        { title: { contains: q } },
        { expenseNumber: { contains: q } },
        { payeeVendor: { contains: q } }
      ];
    }

    return await prisma.expense.findMany({
      where,
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
        branch: { select: { id: true, name: true, code: true } }
      },
      orderBy: { expenseDate: 'desc' }
    });
  }

  // 3. Category-wise summary and totals
  static async getExpenseSummary(
    companyId: string,
    period: { startDate?: string; endDate?: string } = {}
  ) {
    const where: any = { companyId, status: { not: 'REJECTED' } };
    if (period.startDate || period.endDate) {
      where.expenseDate = {};
      if (period.startDate) where.expenseDate.gte = new Date(period.startDate);
      if (period.endDate) where.expenseDate.lte = new Date(period.endDate);
    }

    const expenses = await prisma.expense.findMany({ where });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalGstPaid = expenses.reduce((sum, e) => sum + e.gstPaid, 0);

    const categoryMap: { [key: string]: { total: number; count: number } } = {};
    for (const exp of expenses) {
      if (!categoryMap[exp.category]) {
        categoryMap[exp.category] = { total: 0, count: 0 };
      }
      categoryMap[exp.category].total += exp.amount;
      categoryMap[exp.category].count += 1;
    }

    const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      totalAmount: Number(data.total.toFixed(2)),
      count: data.count,
      percentage: totalAmount > 0 ? Number(((data.total / totalAmount) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalExpenses: Number(totalAmount.toFixed(2)),
      totalGstPaid: Number(totalGstPaid.toFixed(2)),
      expenseCount: expenses.length,
      categoryBreakdown
    };
  }
}
