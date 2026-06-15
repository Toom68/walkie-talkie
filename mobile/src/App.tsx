import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import ChannelSelectScreen from './screens/ChannelSelectScreen';
import WalkieTalkieScreen from './screens/WalkieTalkieScreen';
import SocketService from './services/SocketService';
import AudioService from './services/AudioService';

type Screen = 'login' | 'channels' | 'walkie';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [username, setUsername] = useState('');
  const [currentChannel, setCurrentChannel] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    return () => {
      AudioService.cleanup();
      SocketService.disconnect();
    };
  }, []);

  const handleLogin = async (name: string) => {
    try {
      await SocketService.connect();
      SocketService.setUsername(name);
      setUsername(name);
      setIsConnected(true);
      await AudioService.initializeAudio();
      setCurrentScreen('channels');
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleChannelSelect = (channelId: number) => {
    SocketService.joinChannel(channelId);
    setCurrentChannel(channelId);
    setCurrentScreen('walkie');
  };

  const handleLeaveChannel = () => {
    SocketService.leaveChannel();
    AudioService.removeAllPeerConnections();
    setCurrentChannel(null);
    setCurrentScreen('channels');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'channels':
        return (
          <ChannelSelectScreen
            onSelectChannel={handleChannelSelect}
            username={username}
          />
        );
      case 'walkie':
        return (
          <WalkieTalkieScreen
            channelId={currentChannel!}
            username={username}
            onLeave={handleLeaveChannel}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      {renderScreen()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

export default App;
