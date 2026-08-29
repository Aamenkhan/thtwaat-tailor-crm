import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  Percent,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react-native';

export default function GSTComplianceScreen() {
  const [activeTab, setActiveTab] = useState<'GSTR3B' | 'GSTR1'>('GSTR3B');

  // Queries
  const { data: gstr3bData, isLoading: gstr3bLoading } = useQuery({
    queryKey: ['accounting-gst-3b'],
    queryFn: async () => {
      const res = await api.get('/accounting/gst/gstr-3b');
      return res.data.data;
    }
  });

  const { data: gstr1Data, isLoading: gstr1Loading } = useQuery({
    queryKey: ['accounting-gst-1'],
    queryFn: async () => {
      const res = await api.get('/accounting/gst/gstr-1');
      return res.data.data;
    }
  });

  const isLoading = gstr3bLoading || gstr1Loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>GST Compliance & Tax Filing</Text>
        <Text style={styles.subtitle}>GSTR-1 Outward Supplies & GSTR-3B Input Tax Credit</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'GSTR3B' && styles.tabBtnActive]}
          onPress={() => setActiveTab('GSTR3B')}
        >
          <Text style={[styles.tabText, activeTab === 'GSTR3B' && styles.tabTextActive]}>GSTR-3B Monthly Return</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'GSTR1' && styles.tabBtnActive]}
          onPress={() => setActiveTab('GSTR1')}
        >
          <Text style={[styles.tabText, activeTab === 'GSTR1' && styles.tabTextActive]}>GSTR-1 Outward Table</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : activeTab === 'GSTR3B' ? (
        /* GSTR-3B View */
        <View style={{ marginTop: 14, gap: 12 }}>
          {/* Net Payable Settlement Banner */}
          <Card style={[styles.settleCard, { borderColor: '#DCFCE7' }]}>
            <Text style={styles.settleLabel}>Net GST Tax Payable in Cash</Text>
            <Text style={[styles.settleVal, { color: Colors.primary }]}>
              ₹{gstr3bData?.taxPaymentSettlement?.netTaxPayableInCash?.toLocaleString() ?? 0}
            </Text>
            <Text style={styles.settleSub}>
              Output Tax: ₹{gstr3bData?.outwardSupplies?.totalOutputTax?.toLocaleString()} | ITC Offset: ₹{gstr3bData?.taxPaymentSettlement?.itcUtilized?.toLocaleString()}
            </Text>
          </Card>

          {/* Table 3.1: Outward Taxable Supplies */}
          <Text style={styles.sectionHeading}>Table 3.1: Outward Taxable Supplies</Text>
          <Card style={styles.dataCard}>
            <View style={styles.row}>
              <Text style={styles.label}>Taxable Sales Turnover</Text>
              <Text style={styles.val}>₹{gstr3bData?.outwardSupplies?.taxableTurnover?.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Central Tax (CGST)</Text>
              <Text style={styles.val}>₹{gstr3bData?.outwardSupplies?.cgst?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>State Tax (SGST)</Text>
              <Text style={styles.val}>₹{gstr3bData?.outwardSupplies?.sgst?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Integrated Tax (IGST)</Text>
              <Text style={styles.val}>₹{gstr3bData?.outwardSupplies?.igst?.toLocaleString()}</Text>
            </View>
          </Card>

          {/* Table 4: Eligible Input Tax Credit (ITC) */}
          <Text style={styles.sectionHeading}>Table 4: Eligible Input Tax Credit (ITC)</Text>
          <Card style={styles.dataCard}>
            <View style={styles.row}>
              <Text style={styles.label}>ITC on Raw Materials & Trims</Text>
              <Text style={[styles.val, { color: Colors.success }]}>
                ₹{gstr3bData?.eligibleITC?.itcFromRawMaterials?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>ITC on Factory OPEX & Services</Text>
              <Text style={[styles.val, { color: Colors.success }]}>
                ₹{gstr3bData?.eligibleITC?.itcFromExpenses?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.label, { fontWeight: '800' }]}>Total Eligible ITC Credit</Text>
              <Text style={[styles.val, { color: Colors.success, fontWeight: '800' }]}>
                ₹{gstr3bData?.eligibleITC?.totalEligibleITC?.toLocaleString()}
              </Text>
            </View>
          </Card>
        </View>
      ) : (
        /* GSTR-1 View */
        <View style={{ marginTop: 14, gap: 12 }}>
          <Card style={styles.dataCard}>
            <View style={styles.row}>
              <Text style={styles.label}>Total Taxable Invoices</Text>
              <Text style={styles.val}>{gstr1Data?.summary?.totalInvoices} bills</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total Taxable Value</Text>
              <Text style={styles.val}>₹{gstr1Data?.summary?.totalTaxableValue?.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total Output GST</Text>
              <Text style={[styles.val, { color: Colors.accent }]}>
                ₹{gstr1Data?.summary?.totalOutputTax?.toLocaleString()}
              </Text>
            </View>
          </Card>

          <Text style={styles.sectionHeading}>B2B Registered Invoices ({gstr1Data?.b2bCount ?? 0})</Text>
          {(gstr1Data?.b2bInvoices || []).map((inv: any, idx: number) => (
            <Card key={idx} style={styles.invCard}>
              <View style={styles.invTop}>
                <View>
                  <Text style={styles.invNum}>{inv.invoiceNumber}</Text>
                  <Text style={styles.invCustomer}>{inv.customerName} ({inv.customerGst})</Text>
                </View>
                <Text style={styles.invAmt}>₹{inv.totalInvoiceValue?.toLocaleString()}</Text>
              </View>
              <View style={styles.invMeta}>
                <Text style={styles.metaText}>HSN/SAC: {inv.hsnSac}</Text>
                <Text style={styles.metaText}>POS: {inv.placeOfSupply}</Text>
                <Text style={styles.metaText}>Date: {inv.invoiceDate}</Text>
              </View>
            </Card>
          ))}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  tabBtnActive: {
    backgroundColor: Colors.primary
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  settleCard: {
    padding: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  settleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  settleVal: {
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 4
  },
  settleSub: {
    fontSize: 10,
    color: Colors.textMuted
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4
  },
  dataCard: {
    padding: 14,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4
  },
  label: {
    fontSize: 12,
    color: Colors.text
  },
  val: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  invCard: {
    padding: 12
  },
  invTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  invNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent
  },
  invCustomer: {
    fontSize: 11,
    color: Colors.text,
    marginTop: 1
  },
  invAmt: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  invMeta: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  metaText: {
    fontSize: 10,
    color: Colors.textMuted
  }
});
