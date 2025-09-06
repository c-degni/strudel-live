import React, { useEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { StrudelCollabClient } from '@strudel/collab-client';
import { collabEditingPlugin, collabCSS } from '@strudel/repl/collab/CollabEditor';
import { User } from '@strudel/collab-types';
import { basicSetup } from '@codemirror/basic-setup';
import { initEditor } from '@strudel/codemirror';
import { StateEffect } from '@codemirror/state';
import { useReplContext } from '../repl/useReplContext.jsx';
import { SessionManager } from './SessionManager';
import { SessionHeader } from './SessionHeader';
import { mondo } from '@strudel/mondo';

interface CollabStudelReplProps {
    initialCode?: string;
    onCodeChange: (code: string) => void;
}

export const CollabStrudelRepl: React.FC<CollabStudelReplProps> = ({
    initialCode = '',
    onCodeChange
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const replCtx = typeof useReplContext === 'function' ? useReplContext() : undefined;
    const mondo = replCtx?.mondo ?? ({} as any); // satisfies the param type

    const [collabClient] = useState(() => new StrudelCollabClient());
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User>();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [editorView, setEditorView] = useState<EditorView>();
    
    useEffect(() => {
        // Collab CSS
        const style = document.createElement('style');
        style.textContent = collabCSS;
        document.head.appendChild(style);

        // Collab events
        collabClient['events'] = {
            ...collabClient['events'],
            onUserJoined: (user: User) => {
                setUsers(prev => [...prev, user])
            },
            onUserLeft: (userId: string) => {
                setUsers(prev => prev.filter(u => u.id !== userId));
            },
            onPlayStateChanged: (playing: boolean) => {
                setIsPlaying(playing);
            },
            onConnectionStatusChanged: (connected: boolean) => {
                setIsConnected(connected);
            }
        };

        return () => {
            document.head.removeChild(style);
            collabClient.disconnect();
        };
    }, [collabClient]);

    useEffect(() => {
        // if (editorRef.current && !editorView) {
        //     const extensions = [
        //         basicSetup,
        //         strudel({
        //             evaluateOn: 'Mod-Enter',
        //             showScopes: true
        //         }),
        //         collabEditingPlugin(collabClient),
        //         EditorView.updateListener.of((vu) => {
        //             if (vu.docChanged && onCodeChange) {
        //                 onCodeChange(vu.state.doc.toString());
        //             }
        //         })
        //     ];

        //     const view = new EditorView({
        //         parent: editorRef.current,
        //         doc: initialCode,
        //         extensions
        //     });

        //     setEditorView(view);
        // }
        if (editorRef.current && !editorView) {
            const result = initEditor({
                initialCode,
                root: editorRef.current,
                onChange: (code: string) => onCodeChange?.(code),
                onEvaluate: (code: string) => { 
                    mondo?.evaluate?.(code); 
                    collabClient.requestPlay(); 
                },
                onStop: () => { 
                    mondo?.stop?.(); 
                    collabClient.requestStop(); 
                },
                mondo
            });

            const view: EditorView = result instanceof EditorView ? result : (result as any).view;

            // Add collab plugin to already-configured editor
            view.dispatch({
               effects: StateEffect.appendConfig.of(
                   collabEditingPlugin(collabClient)
                )
            });
    
           setEditorView(view);
           return () => view.destroy();
        }
    }, [editorRef.current, collabClient, editorView, initialCode, onCodeChange, mondo]);

    const handleSessionJoined = (newSessionId: string) => {
        setSessionId(newSessionId);
        setCurrentUser(collabClient.getCurrentUser());
        setUsers(collabClient.getUsers());
    };

    const handlePlay = () => {
        collabClient.requestPlay();
    };

    const handleStop = () => {
        collabClient.requestStop();
    };

    const handleLeaveSession = () => {
        collabClient.disconnect();
        setSessionId(null);
        setUsers([]);
        setCurrentUser(undefined);
    };

    if (!sessionId) {
        return (
            <SessionManager
                collabClient={collabClient}
                onSessionJoined={handleSessionJoined}
            />
        );
    }

    return (
        <div className="collaborative-repl">
            <SessionHeader
                sessionId={sessionId}
                users={users}
                currentUser={currentUser}
                isPlaying={isPlaying}
                isConnected={isConnected}
                onPlay={handlePlay}
                onStop={handleStop}
                onLeaveSession={handleLeaveSession}
            />
            
            <div ref={editorRef} className="editor-container" />
        </div>
      );
}