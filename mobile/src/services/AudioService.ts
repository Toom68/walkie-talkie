import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import SocketService from './SocketService';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class AudioService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private isMuted: boolean = true;
  private onRemoteStreamCallback: ((stream: MediaStream, peerId: string) => void) | null = null;

  async initializeAudio(): Promise<void> {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream as MediaStream;
      // Start muted
      this.muteLocal();
    } catch (error) {
      console.error('Failed to get audio stream:', error);
      throw error;
    }
  }

  muteLocal() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      this.isMuted = true;
    }
  }

  unmuteLocal() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      this.isMuted = false;
    }
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  setOnRemoteStream(callback: (stream: MediaStream, peerId: string) => void) {
    this.onRemoteStreamCallback = callback;
  }

  async createPeerConnection(peerId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      this.peerConnections.get(peerId)!.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        SocketService.sendICECandidate(peerId, event.candidate);
      }
    };

    // Handle remote stream
    pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0], peerId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        this.removePeerConnection(peerId);
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      SocketService.sendWebRTCOffer(peerId, offer);
    }

    return pc;
  }

  async handleOffer(peerId: string, offer: any): Promise<void> {
    const pc = await this.createPeerConnection(peerId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    SocketService.sendWebRTCAnswer(peerId, answer);
  }

  async handleAnswer(peerId: string, answer: any): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleICECandidate(peerId: string, candidate: any): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  removePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  removeAllPeerConnections() {
    for (const [peerId, pc] of this.peerConnections) {
      pc.close();
    }
    this.peerConnections.clear();
  }

  cleanup() {
    this.removeAllPeerConnections();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

export default new AudioService();
