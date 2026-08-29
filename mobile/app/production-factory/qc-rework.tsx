import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  X,
  Camera,
  Layers,
  ShieldCheck
} from 'lucide-react-native';

export default function QCReworkScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'INSPECTION' | 'REWORK_QUEUE'>('INSPECTION');
  const [inspectModal, setInspectModal] = useState(false);

  // Form State
  const [productionOrderId, setProductionOrderId] = useState('');
  const [stage, setStage] = useState('FINAL_QC');
  const [passedQty, setPassedQty] = useState('95');
  const [reworkQty, setReworkQty] = useState('4');
  const [rejectedQty, setRejectedQty] = useState('1');
  const [defectType, setDefectType] = useState('STITCHING_DEFECT');
  const [severity, setSeverity] = useState('MEDIUM');
  const [defectNotes, setDefectNotes] = useState('');

  // Queries
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['factory-qc-dashboard'],
    queryFn: async () => {
      const res = await api.get('/factory/qc/dashboard');
      return res.data.data;
    }
  });

  const { data: ordersData } = useQuery({
    queryKey: ['factory-planning-orders'],
    queryFn: async () => {
      const res = await api.get('/factory/planning/orders');
      return res.data.data;
    }
  });

  // Mutations
  const inspectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/qc/inspect', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-qc-dashboard'] });
      setInspectModal(false);
      Alert.alert('Inspection Logged', 'QC Record & Rework item created successfully!');
    }
  });

  const reworkMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/rework/process', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-qc-dashboard'] });
      Alert.alert('Rework Processed', 'Garment re-inspected and passed back to production pipeline!');
    }
  });

  const handleInspect = () => {
    if (!productionOrderId) {
      Alert.alert('Required', 'Please select a production order');
      return;
    }

    inspectMutation.mutate({
      productionOrderId,
      stage,
      passedQuantity: parseInt(passedQty) || 0,
      reworkQuantity: parseInt(reworkQty) || 0,
      rejectedQuantity: parseInt(rejectedQty) || 0,
      defectType,
      severity,
      defectNotes
    });
  };

  const handlePassRework = (reworkId: string) => {
    reworkMutation.mutate({
      reworkEntryId: reworkId,
      status: 'RE_INSPECTED_PASS',
      reworkCost: 50
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Metrics */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quality Control & Rework</Text>
          <Text style={styles.subtitle}>AQL Inspection & Defect Remediation</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setInspectModal(true)}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Inspect Lot</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Banner */}
      <View style={styles.metricsRow}>
        <Card style={[styles.metricCard, { borderColor: '#DCFCE7' }]}>
          <Text style={styles.metricLabel}>Pass Rate</Text>
          <Text style={[styles.metricVal, { color: Colors.success }]}>{dashboardData?.passRate ?? 100}%</Text>
          <Text style={styles.metricSub}>{dashboardData?.totalPassed ?? 0} garments passed</Text>
        </Card>

        <Card style={[styles.metricCard, { borderColor: '#FEF3C7' }]}>
          <Text style={styles.metricLabel}>Rework Rate</Text>
          <Text style={[styles.metricVal, { color: Colors.warning }]}>{dashboardData?.reworkRate ?? 0}%</Text>
          <Text style={styles.metricSub}>{dashboardData?.totalRework ?? 0} in rework queue</Text>
        </Card>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'INSPECTION' && styles.tabBtnActive]}
          onPress={() => setActiveTab('INSPECTION')}
        >
          <Text style={[styles.tabText, activeTab === 'INSPECTION' && styles.tabTextActive]}>QC History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'REWORK_QUEUE' && styles.tabBtnActive]}
          onPress={() => setActiveTab('REWORK_QUEUE')}
        >
          <Text style={[styles.tabText, activeTab === 'REWORK_QUEUE' && styles.tabTextActive]}>
            Active Rework Queue ({(dashboardData?.reworkEntries || []).filter((r: any) => r.status !== 'RE_INSPECTED_PASS').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: QC History */}
      {activeTab === 'INSPECTION' && (
        <View style={{ gap: 8, marginTop: 12 }}>
          {(dashboardData?.recentQC || []).map((qc: any) => (
            <Card key={qc.id} style={styles.qcCard}>
              <View style={styles.qcHeader}>
                <View>
                  <Text style={styles.qcStage}>Stage: {qc.stage}</Text>
                  <Text style={styles.qcDate}>{qc.createdAt?.split('T')[0]}</Text>
                </View>
                <Badge
                  label={qc.status}
                  variant={qc.status === 'PASSED' ? 'success' : 'danger'}
                />
              </View>

              <View style={styles.countsRow}>
                <Text style={styles.countText}>Passed: <Text style={{ color: Colors.success, fontWeight: '800' }}>{qc.passedQuantity}</Text></Text>
                <Text style={styles.countText}>Rework: <Text style={{ color: Colors.warning, fontWeight: '800' }}>{qc.reworkQuantity}</Text></Text>
                <Text style={styles.countText}>Rejected: <Text style={{ color: Colors.danger, fontWeight: '800' }}>{qc.rejectedQuantity}</Text></Text>
              </View>

              {qc.defectNotes && (
                <Text style={styles.defectNote}>Defect: {qc.defectType} — {qc.defectNotes}</Text>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* Tab 2: Rework Queue */}
      {activeTab === 'REWORK_QUEUE' && (
        <View style={{ gap: 10, marginTop: 12 }}>
          {(dashboardData?.reworkEntries || []).map((rework: any) => {
            const isDone = rework.status === 'RE_INSPECTED_PASS';
            return (
              <Card key={rework.id} style={styles.reworkCard}>
                <View style={styles.reworkTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reworkTitle}>{rework.productionOrder?.productionOrderNumber || 'Order'}</Text>
                    <Text style={styles.reworkDefect}>Defect: {rework.defectType} ({rework.severity})</Text>
                    <Text style={styles.reworkQty}>Quantity: {rework.quantity} pcs</Text>
                  </View>
                  <Badge label={rework.status} variant={isDone ? 'success' : 'warning'} />
                </View>

                {!isDone && (
                  <TouchableOpacity
                    style={styles.passBtn}
                    onPress={() => handlePassRework(rework.id)}
                  >
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text style={styles.passBtnText}>Re-Inspect & Pass Garment</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* Modal: Log QC Inspection */}
      <Modal visible={inspectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lot QC Inspection</Text>
              <TouchableOpacity onPress={() => setInspectModal(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Select Production Order</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                {(ordersData || []).map((ord: any) => (
                  <TouchableOpacity
                    key={ord.id}
                    style={[styles.selectChip, productionOrderId === ord.id && styles.selectChipActive]}
                    onPress={() => setProductionOrderId(ord.id)}
                  >
                    <Text style={[styles.selectChipText, productionOrderId === ord.id && styles.selectChipTextActive]}>
                      {ord.productionOrderNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <AppInput label="Passed Quantity *" value={passedQty} onChangeText={setPassedQty} keyboardType="numeric" />
              <AppInput label="Rework Quantity" value={reworkQty} onChangeText={setReworkQty} keyboardType="numeric" />
              <AppInput label="Rejected / Scrap Quantity" value={rejectedQty} onChangeText={setRejectedQty} keyboardType="numeric" />

              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Defect Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['STITCHING_DEFECT', 'MEASUREMENT_MISMATCH', 'FABRIC_FLAW', 'STAIN', 'BUTTON_LOOSE'].map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    style={[styles.defectChip, defectType === dt && styles.defectChipActive]}
                    onPress={() => setDefectType(dt)}
                  >
                    <Text style={[styles.defectText, defectType === dt && styles.defectTextActive]}>{dt.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppInput label="Defect Notes & Observations" placeholder="e.g. Collar uneven stitch on left side" value={defectNotes} onChangeText={setDefectNotes} />

              <AppButton
                title={inspectMutation.isPending ? 'Logging...' : 'Submit QC Inspection'}
                onPress={handleInspect}
                loading={inspectMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.accent,
    borderRadius: 8
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1.5
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase'
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted
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
  qcCard: {
    padding: 12
  },
  qcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  qcStage: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  qcDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1
  },
  countsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  countText: {
    fontSize: 12,
    color: Colors.text
  },
  defectNote: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 4
  },
  reworkCard: {
    padding: 12
  },
  reworkTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  reworkTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  reworkDefect: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 2
  },
  reworkQty: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  passBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: Colors.success,
    borderRadius: 6,
    marginTop: 4
  },
  passBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8
  },
  selectChipActive: {
    backgroundColor: Colors.primary
  },
  selectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  selectChipTextActive: {
    color: '#FFFFFF'
  },
  defectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9'
  },
  defectChipActive: {
    backgroundColor: '#FEE2E2'
  },
  defectText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700'
  },
  defectTextActive: {
    color: Colors.danger
  }
});
