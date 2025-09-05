import React, { useState, useEffect } from 'react';
import { StrudelCollabClient } from '@strudel/collab-client';

interface SessionManagerProps {
    collabClient: StrudelCollabClient;
    onSessionJoined: (sessionId: string) => void;
}
export const SessionManager: React.FC<SessionManagerProps> = ({
    collabClient,
    onSessionJoined
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [userName, setUserName] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [error, setError] = useState('');

    const handleCreateSession = async () => {
        if (!userName.trim()) {
            setError('Please enter your name');
            return;
        }

        setIsCreating(true);
        setError('');

        try {
            const newSessionId = await collabClient.createSession(userName.trim());
            onSessionJoined(newSessionId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create session');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinSession = () => {
        if (!userName.trim()) {
            setError('Please enter your name');
            return;
        }

        if (!sessionId.trim()) {
            setError('Please enter session ID');
            return;
        }

        setIsJoining(true);
        setError('');

        try {
            collabClient.joinSession(sessionId.trim(), userName.trim());
            onSessionJoined(sessionId.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join session');
            setIsJoining(false);
        }
    };

    const handleSessionIdFromUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionFromUrl = urlParams.get('session');
        if (sessionFromUrl) setSessionId(sessionFromUrl);
    };

    useEffect(() => {
        handleSessionIdFromUrl();
    }, []);

    return (
        <div className="session-manager">
            <div className="session-form">
                <h2>Join Collaborative Session</h2>
            
                <div className="form-group">
                    <label htmlFor="userName">Your Name:</label>
                    <input
                        id="userName"
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Enter your name"
                        maxLength={20}
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="session-actions">
                    <div className="create-session">
                        <h3>Create New Session</h3>
                        <button 
                            onClick={handleCreateSession}
                            disabled={isCreating || !userName.trim()}
                            className="create-btn"
                        >
                            {isCreating ? 'Creating...' : 'Create Session'}
                        </button>
                    </div>

                    <div className="join-session">
                        <h3>Join Existing Session</h3>
                        <div className="form-group">
                            <input
                                type="text"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                placeholder="Session ID"
                            />
                        </div>
                        <button
                            onClick={handleJoinSession}
                            disabled={isJoining || !userName.trim() || !sessionId.trim()}
                            className="join-btn"
                        >
                            {isJoining ? 'Joining...' : 'Join Session'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ); // skull emoji
};