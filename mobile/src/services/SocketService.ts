import { io, Socket } from 'socket.io-client';

const SERVER_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://walkie-talkie-server.onrender.com';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        this.emit('disconnected', reason);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  setUsername(username: string) {
    this.socket?.emit('set-username', username);
  }

  joinChannel(channelId: number) {
    this.socket?.emit('join-channel', channelId);
  }

  leaveChannel() {
    this.socket?.emit('leave-channel');
  }

  pttPress() {
    this.socket?.emit('ptt-press');
  }

  pttRelease() {
    this.socket?.emit('ptt-release');
  }

  sendAudioData(data: any) {
    this.socket?.emit('audio-data', data);
  }

  sendWebRTCOffer(target: string, offer: any) {
    this.socket?.emit('webrtc-offer', { target, offer });
  }

  sendWebRTCAnswer(target: string, answer: any) {
    this.socket?.emit('webrtc-answer', { target, answer });
  }

  sendICECandidate(target: string, candidate: any) {
    this.socket?.emit('webrtc-ice-candidate', { target, candidate });
  }

  on(event: string, callback: Function) {
    this.socket?.on(event, callback as any);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.socket?.off(event, callback as any);
    } else {
      this.socket?.off(event);
    }
  }

  private emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(...args));
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
