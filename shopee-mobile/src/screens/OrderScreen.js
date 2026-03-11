import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { getOrderDetail, getTrackingNumber } from '../services/shopeeApi';
import OrderCard from '../components/OrderCard';

export default function OrderScreen({ order, shopId, shopName, onBack, onChat, onStock }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!order?.order_sn && !order?.orderSn) return;
    const sn = order.order_sn || order.orderSn;
    getOrderDetail(shopId, sn)
      .then((res) => {
        const list = res?.response?.order_list;
        if (list && list.length > 0) setDetail(list[0]);
      })
      .catch((e) => Alert.alert('오류', e.message))
      .finally(() => setLoading(false));
  }, [order, shopId]);

  const handleGetTracking = async () => {
    const sn = (detail || order)?.order_sn || (detail || order)?.orderSn;
    if (!sn) return;
    try {
      const res = await getTrackingNumber(shopId, sn);
      const msg = res?.response?.tracking_number
        ? `송장번호: ${res.response.tracking_number}`
        : JSON.stringify(res?.response || res);
      Alert.alert('송장 번호', msg);
    } catch (e) {
      Alert.alert('오류', e.message);
    }
  };

  const o = detail || order;
  const orderSn = o?.order_sn || o?.orderSn;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>주문 상세</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {loading ? (
          <Text style={styles.loading}>로딩 중...</Text>
        ) : (
          <>
            <Text style={styles.orderSn}>{orderSn}</Text>
            {shopName && <Text style={styles.shopName}>{shopName}</Text>}
            {o?.order_status != null && (
              <View style={styles.row}>
                <Text style={styles.label}>상태</Text>
                <Text style={styles.value}>{o.order_status}</Text>
              </View>
            )}
            {o?.tracking_number && (
              <View style={styles.row}>
                <Text style={styles.label}>송장</Text>
                <Text style={styles.value}>{o.tracking_number}</Text>
              </View>
            )}
            {o?.note && (
              <View style={styles.row}>
                <Text style={styles.label}>메모</Text>
                <Text style={styles.value}>{o.note}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleGetTracking}>
                <Text style={styles.actionBtnText}>송장 번호 조회</Text>
              </TouchableOpacity>
              {onChat && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onChat(o)}>
                  <Text style={styles.actionBtnText}>채팅</Text>
                </TouchableOpacity>
              )}
              {onStock && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onStock(o)}>
                  <Text style={styles.actionBtnText}>재고 수정</Text>
                </TouchableOpacity>
              )}
            </View>
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
  loading: {
    textAlign: 'center',
    color: '#888',
    marginTop: 24,
  },
  orderSn: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: '#333',
  },
  actions: {
    marginTop: 24,
    gap: 10,
  },
  actionBtn: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
