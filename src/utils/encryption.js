/**
 * Basic encryption utilities for sensitive data
 * Uses simple XOR encryption for minimal protection
 */

// Simple XOR encryption key (in production, use a proper encryption library)
const DEFAULT_KEY = "TelegramMonitorEncryptionKey";

/**
 * Simple XOR encryption/decryption
 * @param {string} text - Text to encrypt/decrypt
 * @param {string} key - Encryption key
 * @returns {string} Encrypted/decrypted text
 */
export const xorEncrypt = (text, key = DEFAULT_KEY) => {
  if (!text) return '';
  
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return result;
};

/**
 * XOR decrypt (same as encrypt)
 * @param {string} text - Text to decrypt
 * @param {string} key - Decryption key
 * @returns {string} Decrypted text
 */
export const xorDecrypt = (text, key = DEFAULT_KEY) => {
  return xorEncrypt(text, key);
};

/**
 * Convert text to Base64
 * @param {string} text - Text to encode
 * @returns {string} Base64 encoded text
 */
export const toBase64 = (text) => {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch (e) {
    return '';
  }
};

/**
 * Convert Base64 to text
 * @param {string} base64 - Base64 encoded text
 * @returns {string} Decoded text
 */
export const fromBase64 = (base64) => {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return '';
  }
};

/**
 * Encrypt and encode text
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key
 * @returns {string} Encrypted and encoded text
 */
export const encrypt = (text, key = DEFAULT_KEY) => {
  return toBase64(xorEncrypt(text, key));
};

/**
 * Decode and decrypt text
 * @param {string} encryptedText - Encrypted text
 * @param {string} key - Decryption key
 * @returns {string} Decrypted text
 */
export const decrypt = (encryptedText, key = DEFAULT_KEY) => {
  return xorDecrypt(fromBase64(encryptedText), key);
};

/**
 * Mask sensitive information for display
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} Masked text
 */
export const maskSensitive = (text, visibleChars = 4) => {
  if (!text || text.length <= visibleChars * 2) return text;
  
  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const middle = '•'.repeat(Math.min(10, text.length - visibleChars * 2));
  
  return `${start}${middle}${end}`;
};

export default {
  encrypt,
  decrypt,
  maskSensitive
};
