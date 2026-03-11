import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import OrderCard from '../components/OrderCard';

/**
 * 스캔 후 트래킹 번호 검색 결과 목록
 */
export default function ScanResultScreen({ trackingNumber, orders = [], onSelectOrder, onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>검색 결과</Text>
      </View>
      <Text style={styles.tracking}>송장/바코드: {trackingNumber}</Text>
      {orders.length === 0 ? (
        <Text style={styles.empty}>해당하는 주문이 없습니다.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.order_sn || item.orderSn}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              shopName={item.shop_name}
              onPress={() => onSelectOrder?.(item)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}
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
  tracking: {
    padding: 16,
    fontSize: 14,
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});
