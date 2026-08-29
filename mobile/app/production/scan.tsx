import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import { QrCode, ArrowRight, CheckCircle2, Scissors, ShieldAlert, Sparkles } from 'lucide-react-native';

export default function QRScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [qrInput, setQrInput] = useState('JOB-20260828-1001-1');
  const [matchedJob, setMatchedJob] = useState<any>(null);

  // Scan Mutation
  const scanMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post('/production/scan-qr', { qrText: text });
      return res.data;
    },
    onSuccess: (data) => {
      setMatchedJob(data.jobCard);
    },
    onError: (err: any) => {
      Alert.alert('Scan Failed', err.response?.data?.error || 'No matching Job Card found');
      setMatchedJob(null);
    }
  });

  // Advance Mutation
  const advanceMutation = useMutation({
    mutationFn: async ({ jobCardId, nextStage }: { jobCardId: string; nextStage: string }) => {
      const res = await api.post(`/production/job-cards/${jobCardId}/advance-stage`, {
        nextStage,
        completedQuantity: 1
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      Alert.alert('Stage Updated', `Job moved to ${data.jobCard?.currentStage}`);
      setMatchedJob(null);
      setQrInput('');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update job stage');
    }
  });

  const getNextStage = (current: string) => {
    switch (current) {
      case 'CUTTING': return 'STITCHING';
      case 'STITCHING': return 'FINISHING';
      case 'FINISHING': return 'QC_INSPECTION';
      case 'QC_INSPECTION': return 'IRONING_PACKING';
      case 'IRONING_PACKING': return 'COMPLETED';
      default: return 'COMPLETED';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scanner Visualizer Area */}
      <View style={styles.scannerBox}>
        <View style={styles.viewfinder}>
          <QrCode size={90} color={Colors.accent} />
          <Text style={styles.scanPrompt}>Point Camera at Job Card Tag</Text>
        </View>
      </View>

      {/* Manual / Barcode input */}
      <Card style={styles.inputCard}>
        <AppInput
          label="Barcode / Job Card Number"
          value={qrInput}
          onChangeText={setQrInput}
          placeholder="e.g. JOB-20260828-1001-1"
        />

        <AppButton
          title="Scan / Lookup Job Card"
          onPress={() => scanMutation.mutate(qrInput)}
          loading={scanMutation.isPending}
          variant="primary"
          icon={<QrCode size={16} color="#FFF" />}
        />
      </Card>

      {/* Scanned Job Result */}
      {matchedJob && (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.jobNum}>{matchedJob.jobCardNumber}</Text>
              <Text style={styles.orderRef}>
                Order: {matchedJob.order?.orderNumber} • {matchedJob.order?.customer?.name}
              </Text>
            </View>
            <Badge label={matchedJob.currentStage} variant="purple" />
          </View>

          <View style={styles.garmentBox}>
            <Scissors size={16} color={Colors.accent} />
            <Text style={styles.garmentTitle}>
              {matchedJob.plannedQuantity}x {matchedJob.orderItem?.customItemName}
            </Text>
          </View>

          <View style={styles.actionRow}>
            {matchedJob.currentStage === 'QC_INSPECTION' ? (
              <AppButton
                title="Inspect in QC Console"
                variant="accent"
                onPress={() => router.push('/production/qc')}
                icon={<CheckCircle2 size={16} color="#FFF" />}
                style={{ flex: 1 }}
              />
            ) : (
              <AppButton
                title={`Mark ${getNextStage(matchedJob.currentStage)} Complete`}
                variant="success"
                onPress={() =>
                  advanceMutation.mutate({
                    jobCardId: matchedJob.id,
                    nextStage: getNextStage(matchedJob.currentStage)
                  })
                }
                loading={advanceMutation.isPending}
                icon={<ArrowRight size={16} color="#FFF" />}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Card>
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
  scannerBox: {
    height: 220,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.accent
  },
  viewfinder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  scanPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12
  },
  inputCard: {
    padding: 16
  },
  resultCard: {
    padding: 16,
    marginTop: 14,
    borderWidth: 2,
    borderColor: Colors.accent
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  jobNum: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text
  },
  orderRef: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2
  },
  garmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14
  },
  garmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8
  }
});
