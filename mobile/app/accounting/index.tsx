import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge } from '../../src/components/CommonUI';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  FileText,
  Building,
  CreditCard,
  PieChart,
  ChevronRight,
  RefreshCw,
  Percent,
  Layers
} from 'lucide-react-native';

export default function AccountingDashboardScreen() {
  const router = useRouter();

  const { data: pnlData, isLoading: pnlLoading, refetch: refetchPnl } = useQuery({
    queryKey: ['accounting-pnl-summary'],
    queryFn: async () => {
      const res = await api.get('/accounting/pnl');
      return res.data.data;
    }
  });

  const { data: gstData, isLoading: gstLoading, refetch: refetchGst } = useQuery({
    queryKey: ['accounting-gst-3b-summary'],
    queryFn: async () => {
      const res = await api.get('/accounting/gst/gstr-3b');
      return res.data.data;
    }
  });

  const { data: expData, isLoading: expLoading, refetch: refetchExp } = useQuery({
    queryKey: ['accounting-expenses-summary'],
    queryFn: async () => {
      const res = await api.get('/accounting/expenses/summary');
      return res.data.data;
    }
  });

  const isLoading = pnlLoading || gstLoading || expLoading;

  const handleRefresh = () => {
    refetchPnl();
    refetchGst();
    refetchExp();
  };

  const navCards = [
    {
      title: 'Real-Time Profit & Loss (P&L)',
      desc: 'Gross revenue, COGS, factory OPEX, EBITDA & net profit margin',
      icon: <TrendingUp size={22} color={Colors.success} />,
      route: '/accounting/pnl'
    },
    {
      title: 'Expense Management & Petty Cash',
      desc: 'Rent, electricity, repairs, trims, packaging & receipt photo log',
      icon: <CreditCard size={22} color={Colors.warning} />,
      route: '/accounting/expenses'
    },
    {
      title: 'GST Compliance & Tax Filing',
      desc: 'CGST/SGST/IGST split, GSTR-1 outward turnover & GSTR-3B ITC credit',
      icon: <Percent size={22} color={Colors.accent} />,
      route: '/accounting/gst'
    },
    {
      title: 'Party Ledgers & Statements',
      desc: 'Customer statement of account, vendor payables & debit/credit running balances',
      icon: <FileText size={22} color={Colors.purple} />,
      route: '/accounting/ledger'
    }
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Finance & Accounting Hub</Text>
          <Text style={styles.subtitle}>P&L Statement, GST Compliance, Expenses & Ledgers</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <RefreshCw size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <Card style={[styles.kpiCard, { borderColor: '#DCFCE7' }]}>
          <Text style={styles.kpiLabel}>Net Profit</Text>
          <Text style={[styles.kpiValue, { color: Colors.success }]}>
            ₹{pnlData?.netProfit?.amount?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.kpiSub}>Margin: {pnlData?.netProfit?.marginPercentage ?? 0}%</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#DBEAFE' }]}>
          <Text style={styles.kpiLabel}>Net Revenue</Text>
          <Text style={[styles.kpiValue, { color: Colors.accent }]}>
            ₹{pnlData?.revenue?.netRevenue?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.kpiSub}>{pnlData?.revenue?.invoicesCount ?? 0} invoices</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#FEF3C7' }]}>
          <Text style={styles.kpiLabel}>Total OPEX</Text>
          <Text style={[styles.kpiValue, { color: Colors.warning }]}>
            ₹{expData?.totalExpenses?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.kpiSub}>{expData?.expenseCount ?? 0} expense entries</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#F3E8FF' }]}>
          <Text style={styles.kpiLabel}>Net GST Payable</Text>
          <Text style={[styles.kpiValue, { color: Colors.purple }]}>
            ₹{gstData?.taxPaymentSettlement?.netTaxPayableInCash?.toLocaleString() ?? 0}
          </Text>
          <Text style={styles.kpiSub}>ITC: ₹{gstData?.eligibleITC?.totalEligibleITC ?? 0}</Text>
        </Card>
      </View>

      {/* Navigation Modules */}
      <Text style={styles.sectionTitle}>Accounting Modules</Text>
      {navCards.map((item, idx) => (
        <Card key={idx} style={styles.navCard}>
          <TouchableOpacity
            style={styles.navTouch}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>{item.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>{item.title}</Text>
              <Text style={styles.navDesc}>{item.desc}</Text>
            </View>
            <ChevronRight size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20
  },
  kpiCard: {
    width: '48%',
    padding: 12,
    borderWidth: 1.5
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4
  },
  kpiSub: {
    fontSize: 10,
    color: Colors.textMuted
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 2
  },
  navCard: {
    marginBottom: 10,
    padding: 0
  },
  navTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12
  },
  navIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text
  },
  navDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  }
});
