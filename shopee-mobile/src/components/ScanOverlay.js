import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * 스캔 화면 위에 겹치는 프레임/힌트
 */
export default function ScanOverlay({ hint = '바코드/송장을 프레임에 맞춰주세요' }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.frame} />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
