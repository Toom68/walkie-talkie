import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Vibration,
  Platform,
  Pressable,
} from 'react-native';
import SocketService from '../services/SocketService';
import AudioService from '../services/AudioService';

interface Props {
  channelId: number;
  username: string;
  onLeave: () => void;
}

interface ChannelUser {
  id: string;
  username: string;
  socketId: string;
}

const WalkieTalkieScreen: React.FC<Props> = ({ channelId, username, onLeave }) => {
  const [users, setUsers] = useState<ChannelUser[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentSpeakerName, setCurrentSpeakerName] = useState<string | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const [isGranted, setIsGranted] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [queuePosition, setQueuePosition] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const addLog = useCallback((message: string) => {
    setLog(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()} - ${message}`]);
  }, []);

  useEffect(() => {
    // Set up socket listeners
    SocketService.on('channel-joined', (data: any) => {
      setUsers(data.users || []);
      setCurrentSpeaker(data.currentSpeaker);
      addLog(`Joined channel ${channelId}`);
    });

    SocketService.on('user-joined', (data: any) => {
      setUsers(prev => [...prev, { id: data.userId, username: data.username, socketId: data.socketId }]);
      addLog(`${data.username} joined`);

      // Initiate WebRTC connection to new user
      AudioService.createPeerConnection(data.socketId, true);
    });

    SocketService.on('user-left', (data: any) => {
      setUsers(prev => prev.filter(u => u.socketId !== data.socketId));
      AudioService.removePeerConnection(data.socketId);
      addLog(`${data.username} left`);
    });

    SocketService.on('ptt-granted', (data: any) => {
      setCurrentSpeaker(data.speaker);
      setCurrentSpeakerName(data.username);
      
      if (data.speaker === SocketService.getSocketId()) {
        setIsGranted(true);
        setIsQueued(false);
        AudioService.unmuteLocal();
        Vibration.vibrate(50);
        addLog('PTT granted - you are transmitting');
      } else {
        addLog(`${data.username} is transmitting`);
      }
    });

    SocketService.on('ptt-released', (data: any) => {
      setCurrentSpeaker(null);
      setCurrentSpeakerName(null);
      
      if (data.speaker === SocketService.getSocketId()) {
        setIsGranted(false);
        AudioService.muteLocal();
        addLog('Transmission ended');
      } else {
        addLog(`${data.username} stopped transmitting`);
      }
    });

    SocketService.on('ptt-queued', (data: any) => {
      setIsQueued(true);
      setQueuePosition(data.position);
      addLog(`Queued at position ${data.position} - ${data.currentSpeaker} is speaking`);
    });

    // WebRTC signaling handlers
    SocketService.on('webrtc-offer', async (data: any) => {
      await AudioService.handleOffer(data.sender, data.offer);
    });

    SocketService.on('webrtc-answer', async (data: any) => {
      await AudioService.handleAnswer(data.sender, data.answer);
    });

    SocketService.on('webrtc-ice-candidate', async (data: any) => {
      await AudioService.handleICECandidate(data.sender, data.candidate);
    });

    return () => {
      SocketService.off('channel-joined');
      SocketService.off('user-joined');
      SocketService.off('user-left');
      SocketService.off('ptt-granted');
      SocketService.off('ptt-released');
      SocketService.off('ptt-queued');
      SocketService.off('webrtc-offer');
      SocketService.off('webrtc-answer');
      SocketService.off('webrtc-ice-candidate');
    };
  }, [channelId, addLog]);

  // Pulse animation for PTT button when transmitting
  useEffect(() => {
    if (isGranted) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      return () => {
        pulse.stop();
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      };
    }
  }, [isGranted, pulseAnim, glowAnim]);

  const handlePTTPress = () => {
    setIsPressing(true);
    SocketService.pttPress();
    Vibration.vibrate(30);
  };

  const handlePTTRelease = () => {
    setIsPressing(false);
    setIsQueued(false);
    if (isGranted) {
      SocketService.pttRelease();
      setIsGranted(false);
      AudioService.muteLocal();
    }
  };

  const getPTTButtonStyle = () => {
    if (isGranted) return styles.pttButtonTransmitting;
    if (isQueued) return styles.pttButtonQueued;
    if (isPressing) return styles.pttButtonPressed;
    if (currentSpeaker && currentSpeaker !== SocketService.getSocketId()) {
      return styles.pttButtonBusy;
    }
    return styles.pttButtonIdle;
  };

  const getPTTText = () => {
    if (isGranted) return 'TRANSMITTING';
    if (isQueued) return `QUEUED #${queuePosition}`;
    if (currentSpeaker && currentSpeaker !== SocketService.getSocketId()) {
      return 'CHANNEL BUSY';
    }
    return 'PUSH TO TALK';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onLeave} style={styles.backButton}>
          <Text style={styles.backText}>← Leave</Text>
        </TouchableOpacity>
        <View style={styles.channelBadge}>
          <Text style={styles.channelLabel}>CH</Text>
          <Text style={styles.channelNumber}>{channelId.toString().padStart(3, '0')}</Text>
        </View>
        <View style={styles.userCount}>
          <Text style={styles.userCountText}>{users.length} 👤</Text>
        </View>
      </View>

      {/* Status bar */}
      <View style={[styles.statusBar, currentSpeaker ? styles.statusBarActive : null]}>
        {currentSpeaker ? (
          <Text style={styles.statusText}>
            🔊 {currentSpeakerName || 'Someone'} is transmitting
          </Text>
        ) : (
          <Text style={styles.statusTextIdle}>Channel clear - ready to transmit</Text>
        )}
      </View>

      {/* Users list */}
      <View style={styles.usersSection}>
        <Text style={styles.sectionTitle}>On Channel ({users.length})</Text>
        <ScrollView style={styles.usersList} horizontal showsHorizontalScrollIndicator={false}>
          {users.map(user => (
            <View
              key={user.socketId}
              style={[
                styles.userChip,
                currentSpeaker === user.socketId && styles.userChipSpeaking,
              ]}
            >
              <Text style={styles.userChipText}>
                {currentSpeaker === user.socketId ? '🔊 ' : ''}
                {user.username}
                {user.socketId === SocketService.getSocketId() ? ' (you)' : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* PTT Button */}
      <View style={styles.pttContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPressIn={handlePTTPress}
            onPressOut={handlePTTRelease}
            style={[styles.pttButton, getPTTButtonStyle()]}
          >
            <Text style={styles.pttIcon}>
              {isGranted ? '📡' : isPressing ? '⏳' : '🎙️'}
            </Text>
            <Text style={styles.pttText}>{getPTTText()}</Text>
            {isGranted && (
              <Text style={styles.pttSubtext}>Release to stop</Text>
            )}
          </Pressable>
        </Animated.View>
      </View>

      {/* Activity Log */}
      <View style={styles.logSection}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <ScrollView style={styles.logList} showsVerticalScrollIndicator={false}>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>{entry}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#0f3460',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  channelLabel: {
    color: '#8892b0',
    fontSize: 12,
    marginRight: 4,
  },
  channelNumber: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  userCount: {
    padding: 8,
  },
  userCountText: {
    color: '#ccd6f6',
    fontSize: 14,
  },
  statusBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  statusBarActive: {
    backgroundColor: '#1b4332',
  },
  statusText: {
    color: '#52b788',
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextIdle: {
    color: '#8892b0',
    fontSize: 14,
  },
  usersSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#8892b0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  usersList: {
    maxHeight: 40,
  },
  userChip: {
    backgroundColor: '#16213e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  userChipSpeaking: {
    backgroundColor: '#1b4332',
    borderColor: '#52b788',
  },
  userChipText: {
    color: '#ccd6f6',
    fontSize: 13,
  },
  pttContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  pttButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pttButtonIdle: {
    backgroundColor: '#16213e',
    borderWidth: 4,
    borderColor: '#0f3460',
  },
  pttButtonPressed: {
    backgroundColor: '#1b3a5c',
    borderWidth: 4,
    borderColor: '#3282b8',
  },
  pttButtonTransmitting: {
    backgroundColor: '#1b4332',
    borderWidth: 4,
    borderColor: '#52b788',
  },
  pttButtonQueued: {
    backgroundColor: '#3d2c00',
    borderWidth: 4,
    borderColor: '#f4a261',
  },
  pttButtonBusy: {
    backgroundColor: '#2d1b1b',
    borderWidth: 4,
    borderColor: '#e63946',
    opacity: 0.7,
  },
  pttIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  pttText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  pttSubtext: {
    color: '#8892b0',
    fontSize: 11,
    marginTop: 4,
  },
  logSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    maxHeight: 120,
  },
  logList: {
    maxHeight: 80,
  },
  logEntry: {
    color: '#495670',
    fontSize: 11,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default WalkieTalkieScreen;
