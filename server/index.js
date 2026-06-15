const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Channel state management
// channels: Map<channelId, { users: Map<socketId, {id, username, socketId}>, currentSpeaker: socketId | null, speakerQueue: [] }>
const channels = new Map();

// Initialize 100 channels
for (let i = 1; i <= 100; i++) {
  channels.set(i, {
    id: i,
    users: new Map(),
    currentSpeaker: null,
    speakerQueue: [],
    speakerTimestamp: null
  });
}

const MAX_SPEAK_DURATION = 30000; // 30 seconds max talk time
const SPEAK_COOLDOWN = 500; // 500ms cooldown between speakers

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', channels: 100 });
});

// Get channel info
app.get('/api/channels', (req, res) => {
  const channelList = [];
  for (const [id, channel] of channels) {
    channelList.push({
      id,
      userCount: channel.users.size,
      currentSpeaker: channel.currentSpeaker ? 
        channel.users.get(channel.currentSpeaker)?.username || null : null
    });
  }
  res.json(channelList);
});

app.get('/api/channels/:id', (req, res) => {
  const channelId = parseInt(req.params.id);
  const channel = channels.get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  
  const users = [];
  for (const [, user] of channel.users) {
    users.push({ id: user.id, username: user.username });
  }
  
  res.json({
    id: channel.id,
    users,
    currentSpeaker: channel.currentSpeaker ?
      channel.users.get(channel.currentSpeaker)?.username || null : null
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  let currentChannel = null;
  let username = null;
  let userId = uuidv4();

  socket.on('set-username', (name) => {
    username = name || `User-${userId.slice(0, 6)}`;
    socket.emit('username-set', { userId, username });
  });

  socket.on('join-channel', (channelId) => {
    const id = parseInt(channelId);
    if (id < 1 || id > 100) {
      socket.emit('error', { message: 'Invalid channel (1-100)' });
      return;
    }

    // Leave current channel if in one
    if (currentChannel !== null) {
      leaveChannel(socket, currentChannel);
    }

    const channel = channels.get(id);
    channel.users.set(socket.id, { id: userId, username, socketId: socket.id });
    currentChannel = id;

    socket.join(`channel-${id}`);
    
    // Notify user of successful join
    const users = [];
    for (const [, user] of channel.users) {
      users.push({ id: user.id, username: user.username, socketId: user.socketId });
    }

    socket.emit('channel-joined', {
      channelId: id,
      users,
      currentSpeaker: channel.currentSpeaker
    });

    // Notify others in channel
    socket.to(`channel-${id}`).emit('user-joined', {
      userId,
      username,
      socketId: socket.id
    });

    console.log(`${username} joined channel ${id}`);
  });

  socket.on('leave-channel', () => {
    if (currentChannel !== null) {
      leaveChannel(socket, currentChannel);
      currentChannel = null;
    }
  });

  // Push-to-talk: request floor
  socket.on('ptt-press', () => {
    if (currentChannel === null) return;
    
    const channel = channels.get(currentChannel);
    
    // If no one is speaking, grant floor immediately
    if (channel.currentSpeaker === null) {
      channel.currentSpeaker = socket.id;
      channel.speakerTimestamp = Date.now();
      
      // Notify everyone in channel
      io.to(`channel-${currentChannel}`).emit('ptt-granted', {
        speaker: socket.id,
        username: username
      });

      // Set max duration timeout
      setTimeout(() => {
        if (channel.currentSpeaker === socket.id) {
          releasePTT(socket.id, currentChannel);
        }
      }, MAX_SPEAK_DURATION);

      console.log(`${username} speaking on channel ${currentChannel}`);
    } else if (channel.currentSpeaker !== socket.id) {
      // Someone else is speaking, add to queue
      if (!channel.speakerQueue.includes(socket.id)) {
        channel.speakerQueue.push(socket.id);
        socket.emit('ptt-queued', { 
          position: channel.speakerQueue.length,
          currentSpeaker: channel.users.get(channel.currentSpeaker)?.username
        });
      }
    }
  });

  // Push-to-talk: release floor
  socket.on('ptt-release', () => {
    if (currentChannel === null) return;
    releasePTT(socket.id, currentChannel);
  });

  // WebRTC signaling
  socket.on('webrtc-offer', ({ target, offer }) => {
    io.to(target).emit('webrtc-offer', { sender: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ target, answer }) => {
    io.to(target).emit('webrtc-answer', { sender: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('webrtc-ice-candidate', { sender: socket.id, candidate });
  });

  // Audio data relay (fallback for when WebRTC peer connections aren't feasible)
  socket.on('audio-data', (data) => {
    if (currentChannel === null) return;
    const channel = channels.get(currentChannel);
    
    // Only relay audio from the current speaker
    if (channel.currentSpeaker === socket.id) {
      socket.to(`channel-${currentChannel}`).emit('audio-data', {
        sender: socket.id,
        username: username,
        data: data
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id} (${username})`);
    if (currentChannel !== null) {
      leaveChannel(socket, currentChannel);
    }
  });

  function leaveChannel(socket, channelId) {
    const channel = channels.get(channelId);
    if (!channel) return;

    // If this user was speaking, release the floor
    if (channel.currentSpeaker === socket.id) {
      releasePTT(socket.id, channelId);
    }

    // Remove from queue if queued
    channel.speakerQueue = channel.speakerQueue.filter(id => id !== socket.id);

    // Remove from channel
    channel.users.delete(socket.id);
    socket.leave(`channel-${channelId}`);

    // Notify others
    socket.to(`channel-${channelId}`).emit('user-left', {
      userId,
      username,
      socketId: socket.id
    });

    console.log(`${username} left channel ${channelId}`);
  }

  function releasePTT(speakerId, channelId) {
    const channel = channels.get(channelId);
    if (!channel || channel.currentSpeaker !== speakerId) return;

    channel.currentSpeaker = null;
    channel.speakerTimestamp = null;

    // Notify everyone that speaking has stopped
    io.to(`channel-${channelId}`).emit('ptt-released', {
      speaker: speakerId,
      username: channel.users.get(speakerId)?.username
    });

    // After cooldown, grant floor to next in queue
    setTimeout(() => {
      if (channel.currentSpeaker === null && channel.speakerQueue.length > 0) {
        const nextSpeaker = channel.speakerQueue.shift();
        
        // Verify next speaker is still in channel
        if (channel.users.has(nextSpeaker)) {
          channel.currentSpeaker = nextSpeaker;
          channel.speakerTimestamp = Date.now();
          
          io.to(`channel-${channelId}`).emit('ptt-granted', {
            speaker: nextSpeaker,
            username: channel.users.get(nextSpeaker)?.username
          });

          // Max duration timeout
          setTimeout(() => {
            if (channel.currentSpeaker === nextSpeaker) {
              releasePTT(nextSpeaker, channelId);
            }
          }, MAX_SPEAK_DURATION);
        } else {
          // Skip and try next
          if (channel.speakerQueue.length > 0) {
            releasePTT(null, channelId); // Recurse to next
          }
        }
      }
    }, SPEAK_COOLDOWN);
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Walkie-Talkie server running on port ${PORT}`);
  console.log(`Channels: 1-100 available`);
});
