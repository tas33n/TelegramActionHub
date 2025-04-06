/**
 * Logger utility for the application
 * Provides standardized logging with timestamps and categories
 */

// Log levels and their corresponding colors
const LOG_LEVELS = {
  DEBUG: { color: '#aaa', label: 'DEBUG' },
  INFO: { color: '#0f0', label: 'INFO' },
  SUCCESS: { color: '#0ff', label: 'SUCCESS' },
  WARNING: { color: '#ff0', label: 'WARNING' },
  ERROR: { color: '#f00', label: 'ERROR' }
};

// Maximum number of logs to keep
const MAX_LOGS = 200;

class Logger {
  constructor() {
    this.logs = [];
    this.subscribers = [];
  }

  /**
   * Add a log entry
   * @param {string} message - Log message
   * @param {string} level - Log level (debug, info, success, warning, error)
   * @returns {object} The created log entry
   */
  log(message, level = 'INFO') {
    const logLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    
    const timestamp = new Date();
    const logEntry = {
      id: timestamp.getTime(),
      timestamp,
      text: message,
      level: logLevel.label,
      color: logLevel.color,
      formattedTime: timestamp.toLocaleTimeString()
    };
    
    // Add log to the beginning for chronological order
    this.logs.unshift(logEntry);
    
    // Trim logs if exceeding maximum
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }
    
    // Notify subscribers
    this.subscribers.forEach(callback => callback(this.logs));
    
    // Also log to console for debugging
    console.log(`[${logLevel.label}] ${message}`);
    
    return logEntry;
  }
  
  /**
   * Get all logs
   * @returns {Array} Array of log entries
   */
  getLogs() {
    return [...this.logs];
  }
  
  /**
   * Subscribe to log updates
   * @param {Function} callback - Function to call when logs are updated
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  }
  
  /**
   * Unsubscribe from log updates
   * @param {Function} callback - Function to remove from subscribers
   */
  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }
  
  /**
   * Log a debug message
   * @param {string} message - Debug message
   */
  debug(message) {
    return this.log(message, 'DEBUG');
  }
  
  /**
   * Log an info message
   * @param {string} message - Info message
   */
  info(message) {
    return this.log(message, 'INFO');
  }
  
  /**
   * Log a success message
   * @param {string} message - Success message
   */
  success(message) {
    return this.log(message, 'SUCCESS');
  }
  
  /**
   * Log a warning message
   * @param {string} message - Warning message
   */
  warning(message) {
    return this.log(message, 'WARNING');
  }
  
  /**
   * Log an error message
   * @param {string} message - Error message
   */
  error(message) {
    return this.log(message, 'ERROR');
  }
  
  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.subscribers.forEach(callback => callback(this.logs));
  }
}

// Create a singleton instance
const logger = new Logger();

export default logger;
