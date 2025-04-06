/**
 * Storage utility for persisting data
 * Uses Expo's SecureStore and AsyncStorage
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './logger';

// Keys for stored values
const KEYS = {
  BOT_TOKEN: 'telegramBotToken',
  CHAT_ID: 'telegramChatId',
  APP_SETTINGS: 'appSettings'
};

/**
 * Save a value securely (for sensitive data)
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {Promise}
 */
export const saveSecure = async (key, value) => {
  try {
    // Check if we're on a platform that supports SecureStore
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(key, value);
      logger.debug(`Securely saved: ${key}`);
      return true;
    } else {
      // Fallback to regular storage if secure storage not available
      logger.warning(`SecureStore not available, using fallback for ${key}`);
      return saveToStorage(key, value);
    }
  } catch (error) {
    logger.error(`SecureStore save error (${key}): ${error.message}`);
    // Fallback to regular storage if secure storage fails
    return saveToStorage(key, value);
  }
};

/**
 * Get a securely stored value
 * @param {string} key - Storage key
 * @returns {Promise<string>} The stored value
 */
export const getSecure = async (key) => {
  try {
    // Check if we're on a platform that supports SecureStore
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const value = await SecureStore.getItemAsync(key);
      return value;
    } else {
      // Fallback to regular storage if secure storage not available
      logger.warning(`SecureStore not available, using fallback for ${key}`);
      return getFromStorage(key);
    }
  } catch (error) {
    logger.error(`SecureStore get error (${key}): ${error.message}`);
    // Fallback to regular storage if secure storage fails
    return getFromStorage(key);
  }
};

/**
 * Save value to AsyncStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store (will be JSON stringified)
 * @returns {Promise}
 */
export const saveToStorage = async (key, value) => {
  try {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    logger.debug(`Saved to storage: ${key}`);
    return true;
  } catch (error) {
    logger.error(`AsyncStorage save error (${key}): ${error.message}`);
    return false;
  }
};

/**
 * Get value from AsyncStorage
 * @param {string} key - Storage key
 * @param {boolean} parse - Whether to parse the value as JSON
 * @returns {Promise<any>} The stored value
 */
export const getFromStorage = async (key, parse = true) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null && parse) {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        return value;
      }
    }
    return value;
  } catch (error) {
    logger.error(`AsyncStorage get error (${key}): ${error.message}`);
    return null;
  }
};

/**
 * Save Telegram bot token
 * @param {string} token - Bot token
 * @returns {Promise}
 */
export const saveBotToken = (token) => saveSecure(KEYS.BOT_TOKEN, token);

/**
 * Get Telegram bot token
 * @returns {Promise<string>} Bot token
 */
export const getBotToken = () => getSecure(KEYS.BOT_TOKEN);

/**
 * Save Telegram chat ID
 * @param {string} chatId - Chat ID
 * @returns {Promise}
 */
export const saveChatId = (chatId) => saveSecure(KEYS.CHAT_ID, chatId);

/**
 * Get Telegram chat ID
 * @returns {Promise<string>} Chat ID
 */
export const getChatId = () => getSecure(KEYS.CHAT_ID);

/**
 * Save application settings
 * @param {Object} settings - Settings object
 * @returns {Promise}
 */
export const saveAppSettings = (settings) => saveToStorage(KEYS.APP_SETTINGS, settings);

/**
 * Get application settings
 * @returns {Promise<Object>} Settings object
 */
export const getAppSettings = () => getFromStorage(KEYS.APP_SETTINGS, true);

export default {
  saveSecure,
  getSecure,
  saveToStorage,
  getFromStorage,
  saveBotToken,
  getBotToken,
  saveChatId,
  getChatId,
  saveAppSettings,
  getAppSettings,
  KEYS
};
