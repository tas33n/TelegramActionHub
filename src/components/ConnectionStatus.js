/**
 * Connection status component
 * Displays the connection status to the Telegram API
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import telegramAPI from '../api/telegramAPI';

const ConnectionStatus = ({ 
  style, 
  showLabel = true,
  iconSize = 18,
  pulsateWhenConnected = true 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Set up the pulsing animation
  useEffect(() => {
    let animationLoop;
    
    if (isConnected && pulsateWhenConnected) {
      // Start pulsing animation when connected
      animationLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      
      animationLoop.start();
    } else {
      // Reset animation when disconnected
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    return () => {
      if (animationLoop) {
        animationLoop.stop();
      }
    };
  }, [isConnected, pulsateWhenConnected, pulseAnim]);
  
  // Subscribe to connection status changes
  useEffect(() => {
    const handleConnectionChange = (connected) => {
      setIsConnected(connected);
    };
    
    // Register listener
    telegramAPI.addConnectionListener(handleConnectionChange);
    
    // Initial state
    setIsConnected(telegramAPI.connected);
    
    // Cleanup
    return () => telegramAPI.removeConnectionListener(handleConnectionChange);
  }, []);
  
  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[
        styles.iconContainer,
        isConnected ? styles.connected : styles.disconnected,
        {
          transform: [{ scale: pulseAnim }]
        }
      ]}>
        <Ionicons 
          name={isConnected ? 'md-link' : 'md-unlink'} 
          size={iconSize} 
          color={isConnected ? '#fff' : '#fff'} 
        />
      </Animated.View>
      
      {showLabel && (
        <Text style={[
          styles.statusText,
          isConnected ? styles.connectedText : styles.disconnectedText
        ]}>
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connected: {
    backgroundColor: '#0a0',
  },
  disconnected: {
    backgroundColor: '#a00',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectedText: {
    color: '#0f0',
  },
  disconnectedText: {
    color: '#f00',
  },
});

export default ConnectionStatus;
