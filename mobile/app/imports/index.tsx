import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, API_BASE_URL } from '../../src/api/client';
import { Colors } from '../../src/constants/theme';
import { Card, Badge, AppButton, AppInput } from '../../src/components/CommonUI';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Download,
  Check,
  RefreshCw,
  Info,
  ArrowRight,
  Database
} from 'lucide-react-native';

type ImportType = 'products' | 'customers' | 'inventory';

export default function BulkImportScreen() {
  const [activeTab, setActiveTab] = useState<ImportType>('products');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [pastedData, setPastedData] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);

  // 1. Download Template
  const handleDownloadTemplate = (type: ImportType) => {
    const url = `${API_BASE_URL}/exports/templates/${type}`;
    Linking.openURL(url);
  };

  // 2. Pick Excel File
  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*'
        ],
        copyToCacheDirectory: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setSelectedFile(file);
        setValidationResult(null);
        setCommitResult(null);
      }
    } catch (err: any) {
      Alert.alert('File Picker Error', err.message);
    }
  };

  // 3. Helper to parse CSV/TSV pasted text into JSON rows
  const parsePastedText = (text: string): any[] => {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  };

  // 4. Validate Uploaded / Pasted Data
  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setCommitResult(null);

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          // In web environment
          const fileBlob = (selectedFile as any).file || selectedFile;
          formData.append('file', fileBlob, selectedFile.name);
        } else {
          formData.append('file', {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          } as any);
        }

        res = await api.post(`/imports/${activeTab}/validate`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (pastedData.trim()) {
        const rows = parsePastedText(pastedData);
        if (rows.length === 0) {
          Alert.alert('Invalid Format', 'Please ensure pasted text includes a header row and at least 1 data row.');
          setIsValidating(false);
          return;
        }
        res = await api.post(`/imports/${activeTab}/validate`, { rows });
      } else {
        Alert.alert('No File Selected', 'Please upload an Excel spreadsheet or paste data.');
        setIsValidating(false);
        return;
      }

      setValidationResult(res.data.data);
    } catch (err: any) {
      Alert.alert('Validation Error', err.response?.data?.error || err.message);
    } finally {
      setIsValidating(false);
    }
  };

  // 5. Commit Valid Records
  const handleCommit = async () => {
    if (!validationResult || !validationResult.validRows || validationResult.validRows.length === 0) {
      Alert.alert('No Valid Records', 'There are no valid records ready for import.');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await api.post(`/imports/${activeTab}/commit`, {
        validRows: validationResult.validRows,
        updateDuplicates: true
      });

      setCommitResult(res.data.data);
      Alert.alert('Success', `${res.data.data.created} records created, ${res.data.data.updated} records updated!`);
    } catch (err: any) {
      Alert.alert('Commit Failed', err.response?.data?.error || err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  // 6. Download Error Excel
  const handleDownloadErrors = async () => {
    if (!validationResult?.errors || validationResult.errors.length === 0) return;
    try {
      const res = await api.post(
        '/imports/error-file',
        { errors: validationResult.errors },
        { responseType: 'blob' }
      );
      if (Platform.OS === 'web') {
        const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', `${activeTab}_import_errors.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        Alert.alert('Error Report', 'Error summary logged. Check the on-screen table below for details.');
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title & Description */}
      <View style={styles.header}>
        <Text style={styles.title}>Bulk Data Import Console</Text>
        <Text style={styles.subtitle}>
          Upload Excel (.xlsx) spreadsheets or paste CSV data to import bulk catalog items, customers & stock.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['products', 'customers', 'inventory'] as ImportType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setSelectedFile(null);
              setPastedData('');
              setValidationResult(null);
              setCommitResult(null);
            }}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Step 1: Template Download Banner */}
      <Card style={styles.templateCard}>
        <View style={styles.templateHeader}>
          <FileSpreadsheet size={24} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.templateTitle}>Need an Excel Template?</Text>
            <Text style={styles.templateSub}>
              Download the official pre-formatted template with column headers and sample rows.
            </Text>
          </View>
        </View>
        <AppButton
          title={`Download ${activeTab.toUpperCase()} Template`}
          onPress={() => handleDownloadTemplate(activeTab)}
          variant="outline"
          icon={<Download size={16} color={Colors.text} />}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Step 2: Upload or Paste Data */}
      <Card style={styles.uploadCard}>
        <Text style={styles.sectionHeading}>1. Select File or Paste Data</Text>

        <TouchableOpacity style={styles.dropZone} onPress={handlePickDocument}>
          <UploadCloud size={36} color={Colors.accent} />
          <Text style={styles.dropText}>
            {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to Browse .XLSX / .CSV File'}
          </Text>
          <Text style={styles.dropSub}>Max file size: 10MB • Excel 2007+ (.xlsx)</Text>
        </TouchableOpacity>

        <Text style={styles.orDivider}>— OR PASTE CSV / TAB DATA —</Text>

        <AppInput
          placeholder="Paste rows with header here..."
          value={pastedData}
          onChangeText={(txt) => {
            setPastedData(txt);
            if (txt) setSelectedFile(null);
          }}
          multiline
          numberOfLines={4}
        />

        <AppButton
          title={isValidating ? 'Validating Columns & Data...' : 'Validate & Preview'}
          onPress={handleValidate}
          variant="primary"
          loading={isValidating}
          icon={<RefreshCw size={16} color="#FFFFFF" />}
        />
      </Card>

      {/* Step 3: Validation Preview Metrics */}
      {validationResult && (
        <Card style={styles.resultCard}>
          <Text style={styles.sectionHeading}>2. Validation Summary</Text>

          <View style={styles.metricsRow}>
            <View style={[styles.metricBox, { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.metricVal}>{validationResult.total}</Text>
              <Text style={styles.metricLabel}>Total Rows</Text>
            </View>

            <View style={[styles.metricBox, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.metricVal, { color: Colors.success }]}>{validationResult.validCount}</Text>
              <Text style={styles.metricLabel}>Valid Records</Text>
            </View>

            <View style={[styles.metricBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.metricVal, { color: Colors.danger }]}>{validationResult.errorCount}</Text>
              <Text style={styles.metricLabel}>Invalid / Errors</Text>
            </View>
          </View>

          {/* Error Table if errors exist */}
          {validationResult.errors.length > 0 && (
            <View style={styles.errorSection}>
              <View style={styles.errorHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={18} color={Colors.danger} />
                  <Text style={styles.errorTitle}>Validation Errors Found ({validationResult.errors.length})</Text>
                </View>
                <TouchableOpacity style={styles.downloadErrorBtn} onPress={handleDownloadErrors}>
                  <Download size={14} color={Colors.danger} />
                  <Text style={styles.downloadErrorText}>Error Excel Sheet</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal style={styles.tableScroll}>
                <View style={styles.table}>
                  <View style={styles.tableRowHeader}>
                    <Text style={[styles.th, { width: 60 }]}>Row</Text>
                    <Text style={[styles.th, { width: 110 }]}>SKU/Phone</Text>
                    <Text style={[styles.th, { width: 100 }]}>Field</Text>
                    <Text style={[styles.th, { width: 180 }]}>Error Description</Text>
                    <Text style={[styles.th, { width: 180 }]}>Suggested Fix</Text>
                  </View>

                  {validationResult.errors.slice(0, 10).map((err: any, idx: number) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.td, { width: 60, fontWeight: '700' }]}>#{err.rowNumber}</Text>
                      <Text style={[styles.td, { width: 110 }]}>{err.sku || 'N/A'}</Text>
                      <Text style={[styles.td, { width: 100, color: Colors.danger, fontWeight: '700' }]}>
                        {err.field}
                      </Text>
                      <Text style={[styles.td, { width: 180 }]}>{err.error}</Text>
                      <Text style={[styles.td, { width: 180, color: Colors.textMuted }]}>{err.suggestedFix}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {validationResult.errors.length > 10 && (
                <Text style={styles.moreErrorsText}>
                  + {validationResult.errors.length - 10} more errors. Download Error Excel to view all.
                </Text>
              )}
            </View>
          )}

          {/* Confirm Import Button */}
          {validationResult.validCount > 0 && !commitResult && (
            <View style={{ marginTop: 16 }}>
              <AppButton
                title={`Confirm & Import ${validationResult.validCount} Valid Records`}
                onPress={handleCommit}
                variant="accent"
                loading={isCommitting}
                icon={<Check size={18} color="#FFFFFF" />}
              />
            </View>
          )}

          {/* Success Banner */}
          {commitResult && (
            <View style={styles.commitSuccessBox}>
              <CheckCircle size={28} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commitSuccessTitle}>Import Completed Successfully!</Text>
                <Text style={styles.commitSuccessSub}>
                  Processed {commitResult.total} items ({commitResult.created} created, {commitResult.updated} updated
                  {commitResult.stockMovementsCreated ? `, ${commitResult.stockMovementsCreated} stock logs` : ''}).
                </Text>
              </View>
            </View>
          )}
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
  header: {
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
    marginTop: 4
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
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
  templateCard: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1'
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text
  },
  templateSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  uploadCard: {
    marginTop: 12,
    padding: 16
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12
  },
  dropZone: {
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    marginBottom: 12
  },
  dropText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 8
  },
  dropSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginVertical: 10
  },
  resultCard: {
    marginTop: 16,
    padding: 16
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  metricBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2
  },
  errorSection: {
    marginTop: 12,
    backgroundColor: '#FFF1F2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  errorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger
  },
  downloadErrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.danger
  },
  downloadErrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger
  },
  tableScroll: {
    marginTop: 6
  },
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden'
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 6
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 6
  },
  td: {
    fontSize: 11,
    color: Colors.text
  },
  moreErrorsText: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 8,
    fontStyle: 'italic'
  },
  commitSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DCFCE7',
    padding: 14,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#86EFAC'
  },
  commitSuccessTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.success
  },
  commitSuccessSub: {
    fontSize: 11,
    color: Colors.text,
    marginTop: 2
  }
});
