/**
 * Settings form component
 * Allows user to configure Telegram Bot token and chat ID
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Keyboard,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import telegramAPI from '../api/telegramAPI';
import * as storage from '../utils/storage';
import logger from '../utils/logger';
import { maskSensitive } from '../utils/encryption';

const SettingsForm = ({ 
  onConnect, 
  initialToken = '',
  initialChatId = ''
}) => {
  const [botToken, setBotToken] = useState(initialToken);
  const [chatId, setChatId] = useState(initialChatId);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isChatIdVisible, setIsChatIdVisible] = useState(false);
  const [savedToken, setSavedToken] = useState('');
  const [savedChatId, setSavedChatId] = useState('');
  
  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const token = await storage.getBotToken() || '';
        const chat = await storage.getChatId() || '';
        
        setSavedToken(token);
        setSavedChatId(chat);
        
        // Populate fields if not already set
        if (!botToken && token) setBotToken(token);
        if (!chatId && chat) setChatId(chat);
        
        logger.debug('Loaded saved credentials');
      } catch (error) {
        logger.error(`Failed to load credentials: ${error.message}`);
      }
    };
    
    loadSavedCredentials();
  }, []);
  
  // Handle connect button press
  const handleConnect = async () => {
    if (!botToken || !chatId) {
      Alert.alert('Missing Information', 'Please enter both Bot Token and Chat ID');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    
    try {
      // Save credentials
      await storage.saveBotToken(botToken);
      await storage.saveChatId(chatId);
      
      // Initialize the Telegram API
      const success = telegramAPI.initialize(botToken, chatId);
      
      if (success) {
        logger.success('Connected to Telegram API');
        
        // Update saved values
        setSavedToken(botToken);
        setSavedChatId(chatId);
        
        // Notify parent component
        if (onConnect) {
          onConnect(botToken, chatId);
        }
      } else {
        logger.error('Failed to connect to Telegram API');
        Alert.alert('Connection Failed', 'Could not connect to Telegram with the provided credentials.');
      }
    } catch (error) {
      logger.error(`Connection error: ${error.message}`);
      Alert.alert('Connection Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset to saved credentials
  const handleReset = () => {
    setBotToken(savedToken);
    setChatId(savedChatId);
    logger.info('Reset to saved credentials');
  };
  
  // Check if fields have changed from saved values
  const hasChanges = botToken !== savedToken || chatId !== savedChatId;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Telegram Bot Configuration</Text>
      
      {/* Bot Token Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Bot Token</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={isTokenVisible ? botToken : maskSensitive(botToken)}
            onChangeText={setBotToken}
            placeholder="Enter your Telegram bot token"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!isTokenVisible}
          />
          <TouchableOpacity 
            style={styles.visibilityButton}
            onPress={() => setIsTokenVisible(!isTokenVisible)}
          >
            <Ionicons 
              name={isTokenVisible ? 'eye-off' : 'eye'} 
              size={24} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Chat ID Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Chat ID</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={isChatIdVisible ? chatId : maskSensitive(chatId)}
            onChangeText={setChatId}
            placeholder="Enter your Telegram chat ID"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!isChatIdVisible}
            keyboardType="numeric"
          />
          <TouchableOpacity 
            style={styles.visibilityButton}
            onPress={() => setIsChatIdVisible(!isChatIdVisible)}
          >
            <Ionicons 
              name={isChatIdVisible ? 'eye-off' : 'eye'} 
              size={24} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {hasChanges && (
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={handleReset}
            disabled={isLoading}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={handleConnect}
          disabled={isLoading || (!botToken || !chatId)}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="link" size={18} color="#fff" />
              <Text style={styles.connectButtonText}>
                {telegramAPI.connected ? 'Reconnect' : 'Connect'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Help Text */}
      <Text style={styles.helpText}>
        To use this app, you need a Telegram bot token and chat ID.
        Visit BotFather on Telegram to create a bot.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 16,
    marginVertical: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: 5,
    padding: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  visibilityButton: {
    position: 'absolute',
    right: 10,
    padding: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  resetButton: {
    backgroundColor: '#555',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  connectButton: {
    backgroundColor: '#007bff',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  helpText: {
    color: '#888',
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
});

export default SettingsForm;
