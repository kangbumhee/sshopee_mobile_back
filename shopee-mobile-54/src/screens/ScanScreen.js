import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView } from 'expo-camera';
import { requestCameraPermission, normalizeScannedCode } from '../services/scanner';
import { searchByTrackingNumber } from '../services/shopeeApi';

export default function ScanScreen({ onScanned, onBack }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const granted = await requestCameraPermission();
      setHasPermission(granted);
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    const code = normalizeScannedCode(data);
    if (!code) {
      setScanned(false);
      return;
    }
    try {
      const orders = await searchByTrackingNumber(code);
      onScanned?.({ trackingNumber: code, orders });
    } catch (e) {
      Alert.alert('검색 실패', e.message || '주문 검색 중 오류가 발생했습니다.');
    } finally {
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>카메라 권한 확인 중...</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>카메라 권한이 필요합니다.</Text>
        <TouchableOpacity style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['code128', 'qr', 'ean13', 'ean8'],
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>바코드/송장을 프레임에 맞춰주세요</Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onBack}>
        <Text style={styles.closeButtonText}>✕ 닫기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ee4d2d',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 260,
    height: 120,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 16,
    fontSize: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 15,
  },
});
