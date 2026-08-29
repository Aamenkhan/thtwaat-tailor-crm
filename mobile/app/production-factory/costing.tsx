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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight
} from 'lucide-react-native';

export default function ManufacturingCostingScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'VARIANCE' | 'PAYROLL'>('VARIANCE');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Queries
  const { data: ordersData } = useQuery({
    queryKey: ['factory-planning-orders'],
    queryFn: async () => {
      const res = await api.get('/factory/planning/orders');
      return res.data.data;
    }
  });

  const currentOrderId = selectedOrderId || (ordersData?.[0]?.id ?? '');

  const { data: varianceData, isLoading: varianceLoading } = useQuery({
    queryKey: ['factory-costing-variance', currentOrderId],
    queryFn: async () => {
      if (!currentOrderId) return null;
      const res = await api.get(`/factory/costing/${currentOrderId}/variance`);
      return res.data.data;
    },
    enabled: !!currentOrderId
  });

  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['factory-payroll-workers'],
    queryFn: async () => {
      const res = await api.get('/factory/payroll/workers');
      return res.data.data;
    }
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Costing & Worker Payroll</Text>
        <Text style={styles.subtitle}>BOM vs Actual Variance & Artisan Compensation</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'VARIANCE' && styles.tabBtnActive]}
          onPress={() => setActiveTab('VARIANCE')}
        >
          <Text style={[styles.tabText, activeTab === 'VARIANCE' && styles.tabTextActive]}>Material Variance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PAYROLL' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PAYROLL')}
        >
          <Text style={[styles.tabText, activeTab === 'PAYROLL' && styles.tabTextActive]}>Worker Payroll</Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Material Consumption vs BOM Variance */}
      {activeTab === 'VARIANCE' && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.sectionLabel}>Select Production Order</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {(ordersData || []).map((ord: any) => (
              <TouchableOpacity
                key={ord.id}
                style={[styles.orderChip, (currentOrderId === ord.id) && styles.orderChipActive]}
                onPress={() => setSelectedOrderId(ord.id)}
              >
                <Text style={[styles.orderChipText, (currentOrderId === ord.id) && styles.orderChipTextActive]}>
                  {ord.productionOrderNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {varianceLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : !varianceData ? (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 20 }}>No active production orders.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Total Order Consumption Variance</Text>
                <Text style={[styles.summaryVal, { color: varianceData.totalVarianceCost >= 0 ? Colors.danger : Colors.success }]}>
                  {varianceData.totalVarianceCost >= 0 ? `+₹${varianceData.totalVarianceCost}` : `-₹${Math.abs(varianceData.totalVarianceCost)}`}
                </Text>
                <Text style={styles.summarySub}>Total Garments: {varianceData.totalGarments} pcs</Text>
              </Card>

              <Text style={styles.sectionLabel}>Material Breakdown (BOM vs Actual)</Text>
              {(varianceData.variances || []).map((v: any, i: number) => {
                const isOver = v.variancePerGarment > 0;
                return (
                  <Card key={i} style={styles.varCard}>
                    <View style={styles.varHeader}>
                      <Text style={styles.varMatName}>{v.materialName}</Text>
                      <Badge label={isOver ? `+${v.varianceTotal} ${v.unit}` : 'On Track'} variant={isOver ? 'danger' : 'success'} />
                    </View>
                    <View style={styles.varGrid}>
                      <View style={styles.varItem}>
                        <Text style={styles.varLabel}>BOM Est / Pc</Text>
                        <Text style={styles.varVal}>{v.estimatedPerGarment} {v.unit}</Text>
                      </View>
                      <View style={styles.varItem}>
                        <Text style={styles.varLabel}>Actual / Pc</Text>
                        <Text style={styles.varVal}>{v.actualPerGarment} {v.unit}</Text>
                      </View>
                      <View style={styles.varItem}>
                        <Text style={styles.varLabel}>Variance Cost</Text>
                        <Text style={[styles.varVal, { color: isOver ? Colors.danger : Colors.success }]}>
                          ₹{v.varianceCost}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Tab 2: Worker Payroll */}
      {activeTab === 'PAYROLL' && (
        <View style={{ marginTop: 14, gap: 10 }}>
          {payrollLoading ? (
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : (
            (payrollData || []).map((w: any) => (
              <Card key={w.workerId} style={styles.workerCard}>
                <View style={styles.workerTop}>
                  <View>
                    <Text style={styles.workerName}>{w.workerName}</Text>
                    <Text style={styles.workerRole}>{w.department} • {w.wageType.replace(/_/g, ' ')}</Text>
                  </View>
                  <Badge label={w.status} variant={w.status === 'PAID' ? 'success' : 'warning'} />
                </View>

                <View style={styles.payGrid}>
                  <View style={styles.payItem}>
                    <Text style={styles.payLabel}>Completed Units</Text>
                    <Text style={styles.payVal}>{w.totalPieces} pcs</Text>
                  </View>
                  <View style={styles.payItem}>
                    <Text style={styles.payLabel}>Gross Payout</Text>
                    <Text style={styles.payVal}>₹{w.grossPay}</Text>
                  </View>
                  <View style={styles.payItem}>
                    <Text style={styles.payLabel}>Net Wage Due</Text>
                    <Text style={[styles.payVal, { color: Colors.accent }]}>₹{w.netPay}</Text>
                  </View>
                </View>
              </Card>
            ))
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
    fontSize: 12,
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
  orderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  orderChipActive: {
    backgroundColor: Colors.accent
  },
  orderChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  orderChipTextActive: {
    color: '#FFFFFF'
  },
  summaryCard: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center'
  },
  summaryTitle: {
    fontSize: 12,
    color: Colors.textMuted
  },
  summaryVal: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4
  },
  summarySub: {
    fontSize: 11,
    color: Colors.textMuted
  },
  varCard: {
    padding: 12
  },
  varHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  varMatName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  varGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8
  },
  varItem: {
    flex: 1
  },
  varLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  varVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  },
  workerCard: {
    padding: 12
  },
  workerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  workerName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  workerRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1
  },
  payGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8
  },
  payItem: {
    flex: 1
  },
  payLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  payVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2
  }
});
