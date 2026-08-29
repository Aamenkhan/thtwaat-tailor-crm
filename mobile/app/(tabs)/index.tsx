import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  ShoppingBag,
  TrendingUp,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Sparkles,
  Factory,
  Clock,
  ChevronRight,
  ShieldAlert,
  Layers
} from 'lucide-react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, appMode, setAppMode } = useAuthStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data;
    }
  });

  const overview = data?.overview || {};
  const mfg = data?.manufacturingKpi || {};
  const stages = data?.stageBreakdown || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
    >
      {/* Top Welcome & Mode Switcher */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Master'} 👋</Text>
          <Text style={styles.companyBadge}>{user?.companyName}</Text>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, appMode === 'TAILOR' && styles.modeBtnActive]}
            onPress={() => setAppMode('TAILOR')}
          >
            <Scissors size={14} color={appMode === 'TAILOR' ? '#FFFFFF' : Colors.textMuted} />
            <Text style={[styles.modeText, appMode === 'TAILOR' && styles.modeTextActive]}>Boutique</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, appMode === 'FACTORY' && styles.modeBtnActive]}
            onPress={() => setAppMode('FACTORY')}
          >
            <Factory size={14} color={appMode === 'FACTORY' ? '#FFFFFF' : Colors.textMuted} />
            <Text style={[styles.modeText, appMode === 'FACTORY' && styles.modeTextActive]}>Factory</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Action Shortcuts */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/orders')}>
          <View style={[styles.actionIcon, { backgroundColor: '#EDE9FE' }]}>
            <ShoppingBag size={20} color={Colors.purple} />
          </View>
          <Text style={styles.actionLabel}>+ New Order</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/production/scan')}>
          <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
            <QrCode size={20} color={Colors.accent} />
          </View>
          <Text style={styles.actionLabel}>Scan QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/measurements')}>
          <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
            <Scissors size={20} color={Colors.success} />
          </View>
          <Text style={styles.actionLabel}>Measure</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/production/qc')}>
          <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
            <CheckCircle2 size={20} color={Colors.info} />
          </View>
          <Text style={styles.actionLabel}>QC Check</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Critical Alerts Banner (Delayed Orders / Low Stock) */}
          {(overview.delayedOrdersCount > 0 || overview.lowStockCount > 0) && (
            <View style={styles.alertsContainer}>
              {overview.delayedOrdersCount > 0 && (
                <View style={[styles.alertBanner, { backgroundColor: Colors.dangerLight }]}>
                  <AlertTriangle size={18} color={Colors.danger} />
                  <Text style={[styles.alertText, { color: Colors.danger }]}>
                    {overview.delayedOrdersCount} delayed order(s) past promised delivery date!
                  </Text>
                </View>
              )}

              {overview.lowStockCount > 0 && (
                <View style={[styles.alertBanner, { backgroundColor: Colors.warningLight }]}>
                  <ShieldAlert size={18} color={Colors.warning} />
                  <Text style={[styles.alertText, { color: Colors.warning }]}>
                    {overview.lowStockCount} raw material(s) reached low-stock threshold.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Primary Business Metrics Grid */}
          <View style={styles.kpiGrid}>
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiTitle}>Today's Sales</Text>
                <TrendingUp size={18} color={Colors.success} />
              </View>
              <Text style={styles.kpiValue}>₹{overview.todaysSales?.toLocaleString() || '0'}</Text>
              <Text style={styles.kpiSubtitle}>{overview.todaysOrdersCount || 0} order(s) placed today</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiTitle}>Pending Balance</Text>
                <AlertTriangle size={18} color={Colors.danger} />
              </View>
              <Text style={[styles.kpiValue, { color: Colors.danger }]}>
                ₹{overview.totalOutstandingDue?.toLocaleString() || '0'}
              </Text>
              <Text style={styles.kpiSubtitle}>Across active orders</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiTitle}>In-Production</Text>
                <Layers size={18} color={Colors.accent} />
              </View>
              <Text style={styles.kpiValue}>{overview.totalProductionQuantity || 0} pcs</Text>
              <Text style={styles.kpiSubtitle}>{overview.readyGarments || 0} ready for trial/pickup</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiTitle}>{appMode === 'FACTORY' ? "Today's Output" : 'Active Orders'}</Text>
                <Factory size={18} color={Colors.info} />
              </View>
              <Text style={styles.kpiValue}>
                {appMode === 'FACTORY' ? `${mfg.todaysProductionPcs || 0} pcs` : `${overview.pendingOrdersCount || 0}`}
              </Text>
              <Text style={styles.kpiSubtitle}>
                {appMode === 'FACTORY' ? `QC Pass Rate: ${mfg.qcPassRate || 100}%` : 'In workflow'}
              </Text>
            </Card>
          </View>

          {/* 5-Stage Production Pipeline */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Production Stage Pipeline</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/production')}>
                <Text style={styles.linkText}>View Kanban ➔</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pipelineRow}>
              {[
                { stage: 'Cutting', count: stages.CUTTING || 0, color: Colors.purple },
                { stage: 'Stitching', count: stages.STITCHING || 0, color: Colors.accent },
                { stage: 'Finishing', count: stages.FINISHING || 0, color: Colors.info },
                { stage: 'QC', count: stages.QC_INSPECTION || 0, color: Colors.warning },
                { stage: 'Packing', count: stages.IRONING_PACKING || 0, color: Colors.success }
              ].map((s, idx) => (
                <View key={idx} style={styles.stageItem}>
                  <View style={[styles.stageBubble, { backgroundColor: s.color }]}>
                    <Text style={styles.stageBubbleText}>{s.count}</Text>
                  </View>
                  <Text style={styles.stageName}>{s.stage}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Upcoming Deliveries */}
          {data?.upcomingDeliveries?.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Deliveries (Next 3 Days)</Text>
                <Clock size={18} color={Colors.accent} />
              </View>

              {data.upcomingDeliveries.map((order: any) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => router.push(`/orders/${order.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderCustName}>{order.customer?.name}</Text>
                    <Text style={styles.orderMeta}>
                      {order.orderNumber} • Due: {new Date(order.deliveryDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <Badge label={order.status.replace(/_/g, ' ')} variant="info" />
                  <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </>
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
    paddingBottom: 32
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  greeting: {
    fontSize: 13,
    color: Colors.textMuted
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text
  },
  companyBadge: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 2
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  modeBtnActive: {
    backgroundColor: Colors.primary
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  modeTextActive: {
    color: '#FFFFFF'
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text
  },
  alertsContainer: {
    marginBottom: 14,
    gap: 8
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8
  },
  kpiCard: {
    width: '48%',
    marginBottom: 0,
    padding: 14
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text
  },
  kpiSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4
  },
  sectionCard: {
    marginTop: 12
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text
  },
  linkText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '700'
  },
  pipelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  stageItem: {
    alignItems: 'center'
  },
  stageBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  stageBubbleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  stageName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  orderCustName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text
  },
  orderMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  }
});
