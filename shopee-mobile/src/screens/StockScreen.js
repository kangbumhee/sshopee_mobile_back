import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { updateStock } from '../services/shopeeApi';

/**
 * 재고 수정
 * order.item_list 기반으로 item_id, stock_data 전달
 */
export default function StockScreen({ order, shopId, onBack, onSuccess }) {
  const [stockMap, setStockMap] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const itemList = order?.item_list || [];
  const hasItems = itemList.length > 0;

  const handleStockChange = (itemId, value) => {
    const num = parseInt(value, 10);
    setStockMap((prev) => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSubmit = async () => {
    const stockData = itemList.map((item) => {
      const itemId = item.item_id;
      const newStock = stockMap[itemId] ?? item.stock_info_v2?.summary_info?.total_reserved_stock ?? 0;
      return { model_id: item.model_id, stock: newStock };
    }).filter((s) => s.model_id != null);

    if (stockData.length === 0) {
      Alert.alert('알림', '수정할 재고 항목이 없습니다.');
      return;
    }

    setSubmitting(true);
    try {
      await updateStock(shopId, { item_id: itemList[0]?.item_id, stock_list: stockData });
      Alert.alert('완료', '재고가 반영되었습니다.');
      onSuccess?.();
      onBack?.();
    } catch (e) {
      Alert.alert('오류', e.message || '재고 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>재고 수정</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {!hasItems ? (
          <Text style={styles.empty}>이 주문에 대한 재고 정보가 없습니다.</Text>
        ) : (
          <>
            {itemList.map((item) => (
              <View key={item.model_id || item.item_id} style={styles.row}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.model_sku || item.item_id}
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="재고 수량"
                  value={stockMap[item.item_id]?.toString() ?? item.stock_info_v2?.summary_info?.total_reserved_stock?.toString() ?? ''}
                  onChangeText={(t) => handleStockChange(item.item_id, t)}
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>{submitting ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 16,
    color: '#ee4d2d',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
  row: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
