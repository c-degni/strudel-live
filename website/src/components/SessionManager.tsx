import React, { useState, useEffect } from 'react';
import { StrudelCollabClient } from '@strudel/collab-client';
import { User } from '@strudel/collab-types';

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
        
    };

    const handleSessionIdFromUrl = () => {
        
    };

    useEffect(() => {
        handleSessionIdFromUrl();
    }, []);

    return;
};