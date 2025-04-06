/**
 * Hook for accessing SMS messages with native integration
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SMS from 'expo-sms';
import NativeSmsAccess from '../native-modules/NativeSmsAccess';
import logger from '../utils/logger';
import { createTempFile } from '../services/fileService';

export default function useMessageService() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if SMS is available using Expo SMS
        const available = await SMS.isAvailableAsync();
        setIsAvailable(available);
        
        if (available && Platform.OS === 'android') {
          // Initialize native SMS access
          await NativeSmsAccess.initializeNativeSmsAccess();
          
          // Request SMS permission
          const granted = await NativeSmsAccess.requestSmsPermission();
          setHasPermission(granted);
          
          if (granted) {
            logger.success('SMS access enabled');
          } else {
            logger.warning('SMS permission not granted');
          }
        }
      } catch (error) {
        logger.error(`Failed to initialize SMS service: ${error.message}`);
      }
    };
    
    initialize();
  }, []);

  /**
   * Get SMS messages
   * @param {Object} options - Options for SMS retrieval
   * @returns {Promise<Array>} Array of SMS messages
   */
  const getSmsMessages = useCallback(async (options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!isAvailable) {
        throw new Error('SMS functionality is not available on this device');
      }
      
      if (!hasPermission) {
        throw new Error('SMS permission not granted');
      }
      
      // Get SMS messages using native module
      const messages = await NativeSmsAccess.getSmsMessages(options);
      logger.info(`Retrieved ${messages.length} SMS messages`);
      
      return messages;
    } catch (error) {
      const errorMsg = `Failed to get SMS messages: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, hasPermission]);

  /**
   * Get SMS threads (conversations)
   * @returns {Promise<Array>} Array of SMS threads
   */
  const getSmsThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!isAvailable) {
        throw new Error('SMS functionality is not available on this device');
      }
      
      if (!hasPermission) {
        throw new Error('SMS permission not granted');
      }
      
      // Get SMS threads using native module
      const threads = await NativeSmsAccess.getSmsThreads();
      logger.info(`Retrieved ${threads.length} SMS threads`);
      
      return threads;
    } catch (error) {
      const errorMsg = `Failed to get SMS threads: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, hasPermission]);

  /**
   * Get messages for a specific thread
   * @param {string} threadId - Thread ID
   * @param {number} maxCount - Maximum number of messages to retrieve
   * @returns {Promise<Array>} Array of SMS messages
   */
  const getThreadMessages = useCallback(async (threadId, maxCount = 50) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!isAvailable) {
        throw new Error('SMS functionality is not available on this device');
      }
      
      if (!hasPermission) {
        throw new Error('SMS permission not granted');
      }
      
      // Get thread messages using native module
      const messages = await NativeSmsAccess.getThreadMessages(threadId, maxCount);
      logger.info(`Retrieved ${messages.length} messages for thread ${threadId}`);
      
      return messages;
    } catch (error) {
      const errorMsg = `Failed to get thread messages: ${error.message}`;
      logger.error(errorMsg);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, hasPermission]);

  /**
   * Format SMS messages as CSV
   * @param {Array} messages - Array of SMS messages
   * @returns {Promise<string>} CSV file URI
   */
  const formatSmsAsCSV = useCallback(async (messages) => {
    try {
      if (!messages || !messages.length) {
        return null;
      }
      
      // Create CSV header
      const header = 'Address,Type,Date,Body\n';
      
      // Create CSV content from messages
      const csvContent = messages.reduce((csv, msg) => {
        const address = msg.address.replace(/"/g, '""');
        const type = msg.type.replace(/"/g, '""');
        const date = msg.date.replace(/"/g, '""');
        const body = msg.body.replace(/"/g, '""');
        
        return `${csv}"${address}","${type}","${date}","${body}"\n`;
      }, header);
      
      // Create a temporary file with the CSV content
      const filename = `sms_export_${Date.now()}.csv`;
      const fileUri = await createTempFile(csvContent, filename);
      
      logger.info(`Created SMS CSV export: ${fileUri}`);
      return fileUri;
    } catch (error) {
      logger.error(`Failed to format SMS as CSV: ${error.message}`);
      return null;
    }
  }, []);

  /**
   * Format SMS messages as human-readable text
   * @param {Array} messages - Array of SMS messages
   * @param {number} limit - Maximum number of messages to include
   * @returns {string} Formatted SMS text
   */
  const formatSmsAsText = useCallback((messages, limit = 20) => {
    try {
      if (!messages || !messages.length) {
        return 'No messages available';
      }
      
      // Limit the number of messages
      const limitedMessages = messages.slice(0, limit);
      
      // Create text format
      const text = limitedMessages.map(msg => {
        const direction = msg.type === 'inbox' ? 'From' : 'To';
        return `${direction}: ${msg.address}\nDate: ${msg.date}\n${msg.body}\n${'-'.repeat(40)}`;
      }).join('\n');
      
      return text;
    } catch (error) {
      logger.error(`Failed to format SMS as text: ${error.message}`);
      return 'Error formatting messages';
    }
  }, []);

  return {
    isAvailable,
    isLoading,
    hasPermission,
    error,
    getSmsMessages,
    getSmsThreads,
    getThreadMessages,
    formatSmsAsCSV,
    formatSmsAsText
  };
}