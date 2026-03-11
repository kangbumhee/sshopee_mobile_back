import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { getConnectedShops } from '../services/shopeeApi';
import ShopCard from '../components/ShopCard';

export default function HomeScreen({ onScan, onShopSelect }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadShops = useCallback(async () => {
    try {
      const list = await getConnectedShops();
      setShops(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadShops();
  }, [loadShops]);

  const onRefresh = () => {
    setRefreshing(true);
    loadShops();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>연결된 샵</Text>
        <TouchableOpacity style={styles.scanButton} onPress={onScan}>
          <Text style={styles.scanButtonText}>📷 스캔</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={shops}
        keyExtractor={(item) => String(item.shop_id)}
        renderItem={({ item }) => (
          <ShopCard shop={item} onPress={() => onShopSelect?.(item)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>연결된 샵이 없습니다. 크롬 확장에서 먼저 샵을 연결하세요.</Text>
          ) : null
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  scanButton: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
    paddingHorizontal: 24,
  },
});
