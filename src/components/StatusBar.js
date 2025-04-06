/**
 * Status bar component
 * Displays various status indicators at the top of the app
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConnectionStatus from './ConnectionStatus';

const StatusBar = ({ 
  deviceInfo, 
  isConnected, 
  processingStatus,
  monitoringActive = false,
  lastUpdateTime = null
}) => {
  // Format last update time
  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Never';
    
    const now = new Date();
    const diff = now - lastUpdateTime;
    
    // If less than a minute, show "Just now"
    if (diff < 60000) {
      return 'Just now';
    }
    
    // If less than an hour, show minutes
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    
    // Otherwise show time
    return lastUpdateTime.toLocaleTimeString();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {/* Connection Status */}
        <View style={styles.statusItem}>
          <ConnectionStatus showLabel={false} iconSize={14} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        
        {/* Processing Status */}
        <View style={styles.statusItem}>
          <View style={[
            styles.indicator,
            processingStatus ? styles.processing : styles.idle
          ]}>
            <Ionicons 
              name={processingStatus ? 'ellipsis-horizontal' : 'checkmark'} 
              size={12} 
              color="#fff" 
            />
          </View>
          <Text style={styles.statusText}>
            {processingStatus ? 'Processing' : 'Idle'}
          </Text>
        </View>
        
        {/* Monitoring Status */}
        <View style={styles.statusItem}>
          <View style={[
            styles.indicator,
            monitoringActive ? styles.monitoring : styles.notMonitoring
          ]}>
            <Ionicons 
              name={monitoringActive ? 'radio' : 'radio-outline'} 
              size={12} 
              color="#fff" 
            />
          </View>
          <Text style={styles.statusText}>
            {monitoringActive ? 'Monitoring' : 'Standby'}
          </Text>
        </View>
        
        {/* Device Info */}
        {deviceInfo && (
          <View style={styles.statusItem}>
            <Ionicons name="phone-portrait-outline" size={14} color="#ddd" />
            <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
              {deviceInfo.brand} {deviceInfo.model}
            </Text>
          </View>
        )}
      </View>
      
      {/* Second row for less important info */}
      <View style={styles.statusRow}>
        {/* Last Update Time */}
        <View style={styles.statusItem}>
          <Ionicons name="time-outline" size={14} color="#aaa" />
          <Text style={[styles.statusText, styles.secondaryText]}>
            Last update: {formatLastUpdate()}
          </Text>
        </View>
        
        {/* Network Type */}
        {deviceInfo && deviceInfo.networkType && (
          <View style={styles.statusItem}>
            <Ionicons name="wifi-outline" size={14} color="#aaa" />
            <Text style={[styles.statusText, styles.secondaryText]}>
              {deviceInfo.networkType}
            </Text>
          </View>
        )}
        
        {/* IP Address */}
        {deviceInfo && deviceInfo.ipAddress && (
          <View style={styles.statusItem}>
            <Ionicons name="globe-outline" size={14} color="#aaa" />
            <Text style={[styles.statusText, styles.secondaryText]}>
              {deviceInfo.ipAddress}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 8,
    margin: 8,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  indicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  processing: {
    backgroundColor: '#f80',
  },
  idle: {
    backgroundColor: '#080',
  },
  monitoring: {
    backgroundColor: '#00f',
  },
  notMonitoring: {
    backgroundColor: '#444',
  },
  statusText: {
    color: '#ddd',
    fontSize: 12,
    marginLeft: 4,
  },
  secondaryText: {
    color: '#aaa',
    fontSize: 11,
  }
});

export default StatusBar;
