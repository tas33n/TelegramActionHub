/**
 * Service for handling SMS messages
 */
import * as SMS from 'expo-sms';
import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';

/**
 * Check if SMS is available on the device
 * @returns {Promise<boolean>} Whether SMS is available
 */
export const isSmsAvailable = async () => {
  try {
    return await SMS.isAvailableAsync();
  } catch (error) {
    logger.error(`SMS availability check error: ${error.message}`);
    return false;
  }
};

/**
 * Get SMS messages - Note: This will not work in Expo without a custom native module
 * @param {Object} options - Options for SMS retrieval
 * @returns {Promise<Array>} Array of SMS messages
 */
export const getSmsMessages = async (options = {}) => {
  try {
    const isAvailable = await isSmsAvailable();
    if (!isAvailable) {
      throw new Error('SMS functionality not available on this device');
    }
    
    // Set default options
    const smsOptions = {
      maxCount: options.maxCount || 100,
      fields: options.fields || ['address', 'body', 'date_sent', 'date', 'type'],
      ...options
    };
    
    // Note: This is a placeholder. Expo doesn't provide direct SMS read access
    // On a real device, you'd use a native module to read SMS
    logger.warning('SMS reading not available in Expo. This is a mock implementation.');
    
    // Return placeholder data
    return [];
    
    // In a real implementation with a native module, you'd do something like:
    // const { result } = await SMS.getSmsAsync(smsOptions);
    // return result;
  } catch (error) {
    logger.error(`Failed to get SMS messages: ${error.message}`);
    throw error;
  }
};

/**
 * Format SMS messages as CSV
 * @param {Array} messages - Array of SMS messages
 * @returns {Promise<string>} CSV file URI
 */
export const formatSmsAsCSV = async (messages) => {
  try {
    if (!messages || !Array.isArray(messages)) {
      return null;
    }
    
    // Generate CSV content
    let csv = '"From/To","Message","Date","Type"\n';
    
    messages.forEach(sms => {
      const address = sms.address || '';
      const body = sms.body ? sms.body.replace(/"/g, '""') : '';
      const date = sms.date_sent ? 
        new Date(sms.date_sent).toLocaleString() : 
        (sms.date ? new Date(sms.date).toLocaleString() : '');
      const type = sms.type === 1 ? 'Inbox' : 'Sent';
      
      csv += `"${address}","${body}","${date}","${type}"\n`;
    });
    
    // Save to temporary file
    const filename = `sms_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(filePath, csv);
    logger.info(`SMS exported to CSV: ${filePath}`);
    
    return filePath;
  } catch (error) {
    logger.error(`Failed to format SMS as CSV: ${error.message}`);
    throw error;
  }
};

/**
 * Format SMS messages as human-readable text
 * @param {Array} messages - Array of SMS messages
 * @param {number} limit - Maximum number of messages to include
 * @returns {string} Formatted SMS text
 */
export const formatSmsAsText = (messages, limit = 20) => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return 'No messages available';
    }
    
    // Format each message
    const formattedMessages = messages
      .slice(0, limit)
      .map(sms => {
        const address = sms.address || 'Unknown';
        const body = sms.body || 'No content';
        const date = sms.date_sent ? 
          new Date(sms.date_sent).toLocaleString() : 
          (sms.date ? new Date(sms.date).toLocaleString() : 'Unknown');
        const type = sms.type === 1 ? 'Inbox' : 'Sent';
        
        return `From: ${address}\nType: ${type}\nDate: ${date}\n${body}\n${'─'.repeat(30)}`;
      })
      .join('\n\n');
    
    const summary = `Showing ${Math.min(messages.length, limit)} of ${messages.length} messages`;
    
    return `${summary}\n\n${formattedMessages}`;
  } catch (error) {
    logger.error(`Failed to format SMS as text: ${error.message}`);
    return `Error formatting messages: ${error.message}`;
  }
};

/**
 * Generate a mock SMS dataset for testing
 * @param {number} count - Number of messages to generate
 * @returns {Array} Array of mock SMS messages
 */
export const generateMockSmsData = (count = 10) => {
  const mockSenders = ['+1234567890', '+9876543210', '+1122334455'];
  const mockTypes = [1, 2]; // 1 = inbox, 2 = sent
  
  const messages = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    messages.push({
      id: i.toString(),
      address: mockSenders[i % mockSenders.length],
      body: `This is a sample message #${i + 1} for testing purposes.`,
      date_sent: now - (i * 3600000), // 1 hour intervals
      type: mockTypes[i % mockTypes.length]
    });
  }
  
  return messages;
};

export default {
  isSmsAvailable,
  getSmsMessages,
  formatSmsAsCSV,
  formatSmsAsText,
  generateMockSmsData
};
