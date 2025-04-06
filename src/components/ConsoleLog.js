/**
 * Console log component for displaying application logs
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import logger from '../utils/logger';

const ConsoleLog = ({ 
  maxHeight = 200, 
  autoScroll = true, 
  maxLogs = 50,
  backgroundColor = '#111',
  borderColor = '#444',
  showTimestamp = true,
  fontSize = 12
}) => {
  const [logs, setLogs] = useState([]);
  const scrollViewRef = useRef(null);
  
  // Subscribe to logger updates
  useEffect(() => {
    const handleLogsUpdate = (updatedLogs) => {
      // Get the most recent logs up to maxLogs
      setLogs(updatedLogs.slice(0, maxLogs));
    };
    
    // Subscribe to logger
    logger.subscribe(handleLogsUpdate);
    
    // Initialize with current logs
    setLogs(logger.getLogs().slice(0, maxLogs));
    
    // Unsubscribe on unmount
    return () => logger.unsubscribe(handleLogsUpdate);
  }, [maxLogs]);
  
  // Scroll to bottom when logs change
  useEffect(() => {
    if (autoScroll && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs, autoScroll]);
  
  // Clear logs
  const handleClear = () => {
    logger.clear();
  };
  
  return (
    <View style={[
      styles.container, 
      { maxHeight, backgroundColor, borderColor }
    ]}>
      <View style={styles.header}>
        <Text style={styles.title}>Console</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.logContent}
      >
        {logs.map((log) => (
          <Text key={log.id} style={[
            styles.logEntry, 
            { color: log.color, fontSize }
          ]}>
            {showTimestamp ? `[${log.formattedTime}] ` : ''}
            {log.text}
          </Text>
        ))}
        
        {logs.length === 0 && (
          <Text style={styles.emptyText}>No logs to display</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  clearText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
  },
  scrollView: {
    padding: 8,
  },
  logContent: {
    paddingBottom: 8,
  },
  logEntry: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 2,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  }
});

export default ConsoleLog;
