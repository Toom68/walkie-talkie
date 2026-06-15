import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';

interface Props {
  onSelectChannel: (channelId: number) => void;
  username: string;
}

const ChannelSelectScreen: React.FC<Props> = ({ onSelectChannel, username }) => {
  const [searchText, setSearchText] = useState('');
  const channels = Array.from({ length: 100 }, (_, i) => i + 1);

  const filteredChannels = searchText
    ? channels.filter(ch => ch.toString().includes(searchText))
    : channels;

  const renderChannel = ({ item }: { item: number }) => (
    <TouchableOpacity
      style={styles.channelItem}
      onPress={() => onSelectChannel(item)}
    >
      <View style={styles.channelInfo}>
        <Text style={styles.channelNumber}>CH {item.toString().padStart(3, '0')}</Text>
        <Text style={styles.channelFreq}>
          {(462.5625 + (item - 1) * 0.025).toFixed(4)} MHz
        </Text>
      </View>
      <View style={styles.joinButton}>
        <Text style={styles.joinButtonText}>JOIN</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {username}</Text>
        <Text style={styles.title}>Select Channel</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search channel number..."
          placeholderTextColor="#666"
          value={searchText}
          onChangeText={setSearchText}
          keyboardType="numeric"
        />
      </View>

      <FlatList
        data={filteredChannels}
        renderItem={renderChannel}
        keyExtractor={(item) => item.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 14,
    color: '#8892b0',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  channelItem: {
    flex: 0.48,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  channelInfo: {
    marginBottom: 12,
  },
  channelNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  channelFreq: {
    fontSize: 11,
    color: '#495670',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  joinButton: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default ChannelSelectScreen;
