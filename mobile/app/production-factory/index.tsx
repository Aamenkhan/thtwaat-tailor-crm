import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton } from '../../src/components/CommonUI';
import {
  Factory,
  Layers,
  Scissors,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Package,
  TrendingUp,
  ChevronRight,
  PlusCircle,
  BarChart3,
  RefreshCw
} from 'lucide-react-native';

export default function FactoryDashboardScreen() {
  const router = useRouter();

  const { data: linesData, isLoading: linesLoading, refetch: refetchLines } = useQuery({
    queryKey: ['factory-lines'],
    queryFn: async () => {
      const res = await api.get('/factory/lines');
      return res.data.data;
    }
  });

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['factory-orders-summary'],
    queryFn: async () => {
      const res = await api.get('/factory/planning/orders');
      return res.data.data;
    }
  });

  const { data: qcData, isLoading: qcLoading, refetch: refetchQC } = useQuery({
    queryKey: ['factory-qc-summary'],
    queryFn: async () => {
      const res = await api.get('/factory/qc/dashboard');
      return res.data.data;
    }
  });

  const isLoading = linesLoading || ordersLoading || qcLoading;

  const handleRefresh = () => {
    refetchLines();
    refetchOrders();
    refetchQC();
  };

  const activeOrdersCount = (ordersData || []).filter((o: any) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;
  const avgEfficiency = (linesData || []).length > 0
    ? Number(((linesData || []).reduce((s: number, l: any) => s + (l.efficiencyPercentage || 100), 0) / (linesData || []).length).toFixed(1))
    : 100.0;

  const quickNavItems = [
    {
      title: 'Production Planning & BOM',
      desc: 'Size-color matrix, auto BOM material calculation & stock check',
      icon: <Layers size={22} color={Colors.accent} />,
      route: '/production-factory/planning'
    },
    {
      title: 'Cutting & Fabric Rolls',
      desc: 'Marker length, lay plies, GSM roll tracker & Bundle QR generator',
      icon: <Scissors size={22} color={Colors.purple} />,
      route: '/production-factory/cutting'
    },
    {
      title: 'Stitching Lines & Daily Logs',
      desc: 'Real-time line efficiency %, artisan assignment & daily entry',
      icon: <TrendingUp size={22} color={Colors.info} />,
      route: '/production-factory/lines'
    },
    {
      title: 'Advanced QC & Rework Station',
      desc: 'Defect logging, severity, photos, pass/rework/scrap workflows',
      icon: <CheckCircle2 size={22} color={Colors.success} />,
      route: '/production-factory/qc-rework'
    },
    {
      title: 'Manufacturing Costing & Payroll',
      desc: 'BOM vs actual material variance, costing sheet & artisan wages',
      icon: <DollarSign size={22} color={Colors.warning} />,
      route: '/production-factory/costing'
    },
    {
      title: 'Finished Goods & Dispatch',
      desc: 'Packed warehouse inventory, batch allocation & delivery',
      icon: <Package size={22} color={Colors.primary} />,
      route: '/production-factory/finished-goods'
    }
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
    >
      {/* Factory KPI Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Garment Factory Hub</Text>
          <Text style={styles.subtitle}>Production Floor & Manufacturing Operations</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <RefreshCw size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        <Card style={[styles.kpiCard, { borderColor: '#DBEAFE' }]}>
          <Text style={styles.kpiLabel}>Active Factory Orders</Text>
          <Text style={[styles.kpiValue, { color: Colors.accent }]}>{activeOrdersCount}</Text>
          <Text style={styles.kpiSub}>In production pipeline</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#DCFCE7' }]}>
          <Text style={styles.kpiLabel}>Line Efficiency</Text>
          <Text style={[styles.kpiValue, { color: Colors.success }]}>{avgEfficiency}%</Text>
          <Text style={styles.kpiSub}>{(linesData || []).length} active stitching lines</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#FEF3C7' }]}>
          <Text style={styles.kpiLabel}>QC Pass Rate</Text>
          <Text style={[styles.kpiValue, { color: Colors.warning }]}>{qcData?.passRate ?? 100}%</Text>
          <Text style={styles.kpiSub}>{qcData?.totalRework ?? 0} garments in rework</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: '#F3E8FF' }]}>
          <Text style={styles.kpiLabel}>Total Produced</Text>
          <Text style={[styles.kpiValue, { color: Colors.purple }]}>
            {(linesData || []).reduce((s: number, l: any) => s + (l.todayCompleted || 0), 0)}
          </Text>
          <Text style={styles.kpiSub}>Units today</Text>
        </Card>
      </View>

      {/* Fast Action Modules */}
      <Text style={styles.sectionTitle}>Manufacturing Modules</Text>
      {quickNavItems.map((item, idx) => (
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
    fontSize: 22,
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
