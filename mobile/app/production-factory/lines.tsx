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
  TrendingUp,
  Plus,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  PlusCircle,
  MinusCircle
} from 'lucide-react-native';

export default function StitchingLinesScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [newLineModal, setNewLineModal] = useState(false);

  // Daily Entry Form State
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [stage, setStage] = useState('STITCHING');
  const [targetQty, setTargetQty] = useState('160');
  const [completedQty, setCompletedQty] = useState('140');
  const [reworkQty, setReworkQty] = useState('5');
  const [rejectedQty, setRejectedQty] = useState('2');

  // New Line Form State
  const [lineName, setLineName] = useState('');
  const [lineCode, setLineCode] = useState('');
  const [targetDaily, setTargetDaily] = useState('160');
  const [workerCount, setWorkerCount] = useState('12');

  // Queries
  const { data: linesData, isLoading: linesLoading } = useQuery({
    queryKey: ['factory-lines'],
    queryFn: async () => {
      const res = await api.get('/factory/lines');
      return res.data.data;
    }
  });

  const { data: dailyLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['factory-daily-production'],
    queryFn: async () => {
      const res = await api.get('/factory/daily-production');
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
  const createLineMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/lines', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-lines'] });
      setNewLineModal(false);
      Alert.alert('Line Created', 'New stitching line configured!');
    }
  });

  const logEntryMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/factory/daily-production', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-daily-production'] });
      queryClient.invalidateQueries({ queryKey: ['factory-lines'] });
      setModalVisible(false);
      Alert.alert('Entry Saved', 'Daily production log saved successfully!');
    }
  });

  const handleCreateLine = () => {
    if (!lineName || !lineCode) {
      Alert.alert('Required', 'Please fill Line Name and Code');
      return;
    }
    createLineMutation.mutate({
      name: lineName,
      code: lineCode,
      targetDailyOutput: parseInt(targetDaily) || 160,
      activeWorkerCount: parseInt(workerCount) || 10
    });
  };

  const handleSaveDailyEntry = () => {
    if (!selectedOrder) {
      Alert.alert('Required', 'Please select a production order');
      return;
    }

    logEntryMutation.mutate({
      productionOrderId: selectedOrder,
      productionLineId: selectedLine || undefined,
      stage,
      targetQuantity: parseInt(targetQty) || 100,
      completedQuantity: parseInt(completedQty) || 0,
      reworkQuantity: parseInt(reworkQty) || 0,
      rejectedQuantity: parseInt(rejectedQty) || 0
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Stitching Lines</Text>
          <Text style={styles.sub}>Floor Output & Real-Time Efficiency</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setNewLineModal(true)}>
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.topBtnText}>Add Line</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.topBtn, { backgroundColor: Colors.accent }]} onPress={() => setModalVisible(true)}>
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.topBtnText}>Log Entry</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Production Lines Grid */}
      <Text style={styles.sectionLabel}>Active Production Lines</Text>
      {linesLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 20 }} />
      ) : (
        <View style={{ gap: 10, marginBottom: 20 }}>
          {(linesData || []).map((line: any) => {
            const eff = line.efficiencyPercentage || 100;
            const isGood = eff >= 90;
            return (
              <Card key={line.id} style={styles.lineCard}>
                <View style={styles.lineTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{line.name} ({line.code})</Text>
                    <Text style={styles.lineSub}>
                      {line.activeWorkerCount} artisans | Target: {line.targetDailyOutput} pcs/day
                    </Text>
                  </View>
                  <View style={[styles.effBadge, { backgroundColor: isGood ? '#DCFCE7' : '#FEF3C7' }]}>
                    <Text style={[styles.effText, { color: isGood ? Colors.success : Colors.warning }]}>
                      {eff}% Efficiency
                    </Text>
                  </View>
                </View>

                {/* Progress bar visual */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(eff, 100)}%`, backgroundColor: isGood ? Colors.success : Colors.warning }]} />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Recent Production Entries */}
      <Text style={styles.sectionLabel}>Recent Floor Logs</Text>
      {logsLoading ? (
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginVertical: 20 }} />
      ) : (
        <View style={{ gap: 8 }}>
          {(dailyLogs || []).slice(0, 15).map((log: any) => (
            <Card key={log.id} style={styles.logCard}>
              <View style={styles.logLeft}>
                <Text style={styles.logTitle}>
                  {log.productionOrder?.styleNumber} — {log.stage}
                </Text>
                <Text style={styles.logSub}>
                  Line: {log.productionLine?.code || 'General'} | Date: {log.entryDate?.split('T')[0]}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.logDone}>{log.completedQuantity} / {log.targetQuantity} pcs</Text>
                <Text style={styles.logMeta}>Rework: {log.reworkQuantity} | Rej: {log.rejectedQuantity}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Modal: Daily Production Entry */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Daily Production Entry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted }}>Select Production Order</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                {(ordersData || []).map((ord: any) => (
                  <TouchableOpacity
                    key={ord.id}
                    style={[styles.selectChip, selectedOrder === ord.id && styles.selectChipActive]}
                    onPress={() => setSelectedOrder(ord.id)}
                  >
                    <Text style={[styles.selectChipText, selectedOrder === ord.id && styles.selectChipTextActive]}>
                      {ord.productionOrderNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginTop: 4 }}>Select Stage</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['CUTTING', 'STITCHING', 'FINISHING', 'PACKING'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.stageChip, stage === st && styles.stageChipActive]}
                    onPress={() => setStage(st)}
                  >
                    <Text style={[styles.stageText, stage === st && styles.stageTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AppInput label="Target Quantity" value={targetQty} onChangeText={setTargetQty} keyboardType="numeric" />
              <AppInput label="Completed Quantity *" value={completedQty} onChangeText={setCompletedQty} keyboardType="numeric" />
              <AppInput label="Rework Quantity" value={reworkQty} onChangeText={setReworkQty} keyboardType="numeric" />
              <AppInput label="Rejected Quantity" value={rejectedQty} onChangeText={setRejectedQty} keyboardType="numeric" />

              <AppButton
                title={logEntryMutation.isPending ? 'Saving Log...' : 'Save Daily Production Log'}
                onPress={handleSaveDailyEntry}
                loading={logEntryMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: New Line */}
      <Modal visible={newLineModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Production Line</Text>
              <TouchableOpacity onPress={() => setNewLineModal(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <AppInput label="Line Name *" placeholder="e.g. Line 1 - Formal Suits" value={lineName} onChangeText={setLineName} />
              <AppInput label="Line Code *" placeholder="e.g. LINE-01" value={lineCode} onChangeText={setLineCode} />
              <AppInput label="Target Daily Output (Pcs)" placeholder="160" value={targetDaily} onChangeText={setTargetDaily} keyboardType="numeric" />
              <AppInput label="Active Worker Count" placeholder="12" value={workerCount} onChangeText={setWorkerCount} keyboardType="numeric" />

              <AppButton
                title={createLineMutation.isPending ? 'Saving...' : 'Create Line'}
                onPress={handleCreateLine}
                loading={createLineMutation.isPending}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text
  },
  sub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8
  },
  topBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  lineCard: {
    padding: 14
  },
  lineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  lineName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text
  },
  lineSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  effBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  effText: {
    fontSize: 11,
    fontWeight: '800'
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12
  },
  logLeft: {
    flex: 1
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  logSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  logDone: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent
  },
  logMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
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
  stageChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderRadius: 6
  },
  stageChipActive: {
    backgroundColor: Colors.accent
  },
  stageText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  stageTextActive: {
    color: '#FFFFFF'
  }
});
