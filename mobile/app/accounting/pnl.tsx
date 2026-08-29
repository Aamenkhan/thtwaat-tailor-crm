import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge } from '../../src/components/CommonUI';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Minus,
  Equal
} from 'lucide-react-native';

export default function ProfitAndLossScreen() {
  const { data: pnl, isLoading, refetch } = useQuery({
    queryKey: ['accounting-pnl-detailed'],
    queryFn: async () => {
      const res = await api.get('/accounting/pnl');
      return res.data.data;
    }
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Profit & Loss (P&L) Statement</Text>
          <Text style={styles.subtitle}>Real-Time Income Statement & Factory Operating Margins</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          <RefreshCw size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ gap: 12 }}>
          {/* Net Profit Hero Card */}
          <Card style={[styles.heroCard, { borderColor: pnl?.netProfit?.isProfitable ? '#DCFCE7' : '#FEE2E2' }]}>
            <Text style={styles.heroLabel}>Net Profit / (Loss)</Text>
            <Text style={[styles.heroVal, { color: pnl?.netProfit?.isProfitable ? Colors.success : Colors.danger }]}>
              ₹{pnl?.netProfit?.amount?.toLocaleString()}
            </Text>
            <Text style={styles.heroSub}>
              Net Margin: {pnl?.netProfit?.marginPercentage}% | Invoices: {pnl?.revenue?.invoicesCount}
            </Text>
          </Card>

          {/* Section 1: Revenue */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>1. Gross Revenue</Text>
              <Text style={[styles.sectionTotal, { color: Colors.accent }]}>
                ₹{pnl?.revenue?.netRevenue?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Invoiced Sales & Bespoke Orders</Text>
              <Text style={styles.subVal}>₹{pnl?.revenue?.grossInvoicedSales?.toLocaleString()}</Text>
            </View>
            {pnl?.revenue?.discounts > 0 && (
              <View style={styles.row}>
                <Text style={[styles.subItem, { color: Colors.danger }]}>Less: Customer Discounts</Text>
                <Text style={[styles.subVal, { color: Colors.danger }]}>-₹{pnl?.revenue?.discounts?.toLocaleString()}</Text>
              </View>
            )}
          </Card>

          {/* Section 2: COGS */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. Cost of Goods Sold (COGS)</Text>
              <Text style={[styles.sectionTotal, { color: Colors.danger }]}>
                -₹{pnl?.costOfGoodsSold?.totalCOGS?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Raw Material / Fabric Consumption</Text>
              <Text style={styles.subVal}>₹{pnl?.costOfGoodsSold?.rawMaterialConsumption?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Artisan & Tailor Piece-Rate Wages</Text>
              <Text style={styles.subVal}>₹{pnl?.costOfGoodsSold?.artisanPieceRateWages?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Direct Outsourcing (Embroidery/Printing)</Text>
              <Text style={styles.subVal}>₹{pnl?.costOfGoodsSold?.manufacturingOutsourcing?.toLocaleString()}</Text>
            </View>
          </Card>

          {/* Gross Profit Banner */}
          <Card style={[styles.kpiBanner, { backgroundColor: '#EFF6FF' }]}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Gross Profit</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>
                ₹{pnl?.grossProfit?.amount?.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Gross Margin: {pnl?.grossProfit?.marginPercentage}%</Text>
            </View>
          </Card>

          {/* Section 3: Operating Expenses (OPEX) */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>3. Factory Operating Expenses (OPEX)</Text>
              <Text style={[styles.sectionTotal, { color: Colors.warning }]}>
                -₹{pnl?.operatingExpenses?.totalOPEX?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Factory Rent</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.rent?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Electricity & Power</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.electricityPower?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Machine Maintenance & Oil</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.machineMaintenance?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Staff & Admin Salaries</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.staffSalary?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Packaging & Boxes</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.packaging?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Logistics & Fuel</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.logisticsFuel?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.subItem}>Tea, Refreshments & Misc</Text>
              <Text style={styles.subVal}>₹{pnl?.operatingExpenses?.teaRefreshments?.toLocaleString()}</Text>
            </View>
          </Card>

          {/* Section 4: Operating Profit EBITDA */}
          <Card style={[styles.kpiBanner, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>Operating Profit (EBITDA)</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.text }}>
                ₹{pnl?.operatingProfitEBITDA?.amount?.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>EBITDA Margin: {pnl?.operatingProfitEBITDA?.marginPercentage}%</Text>
            </View>
          </Card>
        </View>
      )}
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
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },
  heroCard: {
    padding: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  heroVal: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4
  },
  heroSub: {
    fontSize: 11,
    color: Colors.textMuted
  },
  sectionCard: {
    padding: 14,
    gap: 8
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '800'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subItem: {
    fontSize: 12,
    color: Colors.textMuted
  },
  subVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text
  },
  kpiBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10
  }
});
