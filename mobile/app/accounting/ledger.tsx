import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge } from '../../src/components/CommonUI';
import {
  FileText,
  User,
  Building,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react-native';

export default function LedgerScreen() {
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'VENDORS'>('CUSTOMERS');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Fetch Customers & Vendors
  const { data: customersData } = useQuery({
    queryKey: ['customers-list-ledger'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data.data;
    }
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list-ledger'],
    queryFn: async () => {
      const res = await api.get('/purchases');
      return res.data.data;
    }
  });

  const currentCustomerId = selectedCustomerId || (customersData?.[0]?.id ?? '');

  const { data: customerLedger, isLoading: custLoading } = useQuery({
    queryKey: ['accounting-customer-ledger', currentCustomerId],
    queryFn: async () => {
      if (!currentCustomerId) return null;
      const res = await api.get(`/accounting/ledger/customer/${currentCustomerId}`);
      return res.data.data;
    },
    enabled: !!currentCustomerId && activeTab === 'CUSTOMERS'
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Party Ledgers & Statements</Text>
        <Text style={styles.subtitle}>Debit/Credit Running Balances & Payment Audits</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CUSTOMERS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('CUSTOMERS')}
        >
          <Text style={[styles.tabText, activeTab === 'CUSTOMERS' && styles.tabTextActive]}>Customer Statements</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'VENDORS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('VENDORS')}
        >
          <Text style={[styles.tabText, activeTab === 'VENDORS' && styles.tabTextActive]}>Vendor Payables</Text>
        </TouchableOpacity>
      </View>

      {/* Customer Selector */}
      {activeTab === 'CUSTOMERS' && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.sectionLabel}>Select Customer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {(customersData || []).map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, currentCustomerId === c.id && styles.chipActive]}
                onPress={() => setSelectedCustomerId(c.id)}
              >
                <Text style={[styles.chipText, currentCustomerId === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {custLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : !customerLedger ? (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 20 }}>No ledger transactions.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Customer Balance Summary */}
              <Card style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.custName}>{customerLedger.customer?.name}</Text>
                    <Text style={styles.custPhone}>{customerLedger.customer?.phone}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.balLabel}>Outstanding Balance</Text>
                    <Text style={[styles.balVal, { color: customerLedger.summary?.outstandingBalance > 0 ? Colors.danger : Colors.success }]}>
                      ₹{customerLedger.summary?.outstandingBalance?.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <Text style={styles.statsText}>Total Invoiced: ₹{customerLedger.summary?.totalInvoiced?.toLocaleString()}</Text>
                  <Text style={styles.statsText}>Total Received: ₹{customerLedger.summary?.totalPaid?.toLocaleString()}</Text>
                </View>
              </Card>

              {/* Transactions Ledger Table */}
              <Text style={styles.sectionLabel}>Statement of Account</Text>
              {(customerLedger.transactions || []).map((tx: any) => {
                const isInvoice = tx.type === 'INVOICE';
                return (
                  <Card key={tx.id} style={styles.txCard}>
                    <View style={styles.txTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txTitle}>{tx.description}</Text>
                        <Text style={styles.txDate}>{tx.date} • Ref: {tx.reference}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.txAmt, { color: isInvoice ? Colors.danger : Colors.success }]}>
                          {isInvoice ? `+₹${tx.debit}` : `-₹${tx.credit}`}
                        </Text>
                        <Text style={styles.txBal}>Bal: ₹{tx.runningBalance}</Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  chipActive: {
    backgroundColor: Colors.accent
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  chipTextActive: {
    color: '#FFFFFF'
  },
  summaryCard: {
    padding: 14,
    backgroundColor: '#F8FAFC'
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  custName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  custPhone: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  balLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  balVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  statsText: {
    fontSize: 11,
    color: Colors.textMuted
  },
  txCard: {
    padding: 12
  },
  txTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  txDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  txAmt: {
    fontSize: 14,
    fontWeight: '800'
  },
  txBal: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  }
});
