import React from 'react';
import { User } from '@strudel/collab-types';

interface SessionHeaderProps {
    sessionId: string;
    users: User[];
    currentUser?: User;
    isPlaying: boolean;
    isConnected: boolean;
    onPlay: () => void;
    onStop: () => void;
    onLeaveSession: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
    sessionId,
    users,
    currentUser,
    isPlaying,
    isConnected,
    onPlay,
    onStop,
    onLeaveSession
}) => {
    const copySessionLink = () => {
        const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
        navigator.clipboard.writeText(url); // May add toast noti later
    };

    const shareSession = async () => {
        const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my Strudel session',
                    text: 'Come make music with me in Strudel!',
                    url: url
                });
            } catch (err) {
                // Fallback on copy (may be same res)
                copySessionLink();
            }
        } else {
            copySessionLink();
        }
    };

    return (
        <div className="session-header">
            <div className="session-info">
                <div className="session-id">
                    <span>Session: {sessionId}</span>
                    <button onClick={shareSession} className="share-btn" title="Share session">
                        📋
                    </button>
                </div>
            
                <div className="connection-status">
                    <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? '🟢' : '🔴'} {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            <div className="playback-controls">
                <button 
                    onClick={onPlay}
                    disabled={isPlaying || !isConnected}
                    className="play-button"
                    title="Start playback (locks editing for all users)"
                >
                    ▶️ Play
                </button>
            
                <button 
                    onClick={onStop}
                    disabled={!isPlaying || !isConnected}
                    className="stop-button"
                    title="Stop playback"
                >
                    ⏹️ Stop
                </button>
            
                {isPlaying && (
                    <span className="playing-indicator">
                        🔒 Editing locked during playback
                    </span>
                )}
            </div>

            <div className="user-list">
                {users.map(user => (
                    <div 
                        key={user.id} 
                        className="user-avatar" 
                        style={{ backgroundColor: user.color }}
                        title={user.name}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                ))}
            
                {currentUser && (
                    <div 
                        className="user-avatar current-user" 
                        style={{ backgroundColor: currentUser.color }}
                        title={`${currentUser.name} (You)`}
                    >
                        {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                )}
            
                <span className="user-count">{users.length + (currentUser ? 1 : 0)} users</span>
            </div>

            <button onClick={onLeaveSession} className="leave-session-btn">
                Leave Session
            </button>
        </div>
    );
};