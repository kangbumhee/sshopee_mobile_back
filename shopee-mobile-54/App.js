import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthChange, getCurrentUser } from './src/services/auth';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import ScanResultScreen from './src/screens/ScanResultScreen';
import OrderScreen from './src/screens/OrderScreen';
import ChatScreen from './src/screens/ChatScreen';
import StockScreen from './src/screens/StockScreen';
import ProductScreen from './src/screens/ProductScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={() => setUser(getCurrentUser())} />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              onScan={() => props.navigation.navigate('Scan')}
              onShopSelect={(shop) => props.navigation.navigate('Scan')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Scan">
          {(props) => (
            <ScanScreen
              onBack={() => props.navigation.goBack()}
              onScanned={({ trackingNumber, orders }) =>
                props.navigation.navigate('ScanResult', { trackingNumber, orders })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ScanResult">
          {(props) => (
            <ScanResultScreen
              trackingNumber={props.route.params?.trackingNumber ?? ''}
              orders={props.route.params?.orders ?? []}
              onBack={() => props.navigation.goBack()}
              onSelectOrder={(order) =>
                props.navigation.navigate('Order', {
                  order,
                  shopId: order.shop_id,
                  shopName: order.shop_name,
                })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Order">
          {(props) => (
            <OrderScreen
              order={props.route.params?.order}
              shopId={props.route.params?.shopId}
              shopName={props.route.params?.shopName}
              onBack={() => props.navigation.goBack()}
              onChat={(o) =>
                props.navigation.navigate('Chat', {
                  order: o,
                  shopId: props.route.params?.shopId,
                })
              }
              onStock={(o) =>
                props.navigation.navigate('Stock', {
                  order: o,
                  shopId: props.route.params?.shopId,
                })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Chat">
          {(props) => (
            <ChatScreen
              order={props.route.params?.order}
              shopId={props.route.params?.shopId}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Stock">
          {(props) => (
            <StockScreen
              order={props.route.params?.order}
              shopId={props.route.params?.shopId}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Product">
          {(props) => (
            <ProductScreen
              productId={props.route.params?.productId}
              shopId={props.route.params?.shopId}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
