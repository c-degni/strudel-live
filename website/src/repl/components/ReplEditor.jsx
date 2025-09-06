import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { StrudelCollabClient } from '@strudel/collab-client';
import { useState, useEffect } from 'react';

// type Props = {
//  context: replcontext,
// }

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { containerRef, editorRef, error, init, pending } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;

  const [collabClient] = useState(() => new StrudelCollabClient());
  const [sessionId, setSessionId] = useState(null);
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(false);

  useEffect(() => {
    collabClient.events = {
      onUserJoined: (user) => setUsers(prev => [...prev, user]),
      onUserLeft: (userId) => setUsers(prev => prev.filter(u => u.id !== userId)),
      onConnectionStatusChanged: setIsConnected,
    };
  }, [collabClient]);

  const handleCreateSession = async () => {
    const userName = prompt('Enter your name:');
    if (userName) {
      try {
        const newSessionId = await collabClient.createSession(userName);
        setSessionId(newSessionId);
        setShowSessionManager(false);
      } catch (err) {
        alert('Failed to create session: ' + err.message);
      }
    }
  };

  const handleJoinSession = () => {
    const sessionId = prompt('Enter session ID:');
    const userName = prompt('Enter your name:');
    if (sessionId && userName) {
      collabClient.joinSession(sessionId, userName);
      setSessionId(sessionId);
      setShowSessionManager(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      
      {/* ADD SESSION CONTROLS HERE */}
      <div className="bg-gray-800 border-b border-gray-600 px-4 py-2 text-sm">
        {!sessionId ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSessionManager(!showSessionManager)}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
            >
              Collaborate
            </button>
            {showSessionManager && (
              <div className="flex gap-2">
                <button 
                  onClick={handleCreateSession}
                  className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
                >
                  Create Session
                </button>
                <button 
                  onClick={handleJoinSession}
                  className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-white"
                >
                  Join Session
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-white">
              Session: <span className="font-mono">{sessionId}</span> | 
              Users: {users.length + 1} | 
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button 
              onClick={() => { collabClient.disconnect(); setSessionId(null); setUsers([]); }}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
            >
              Leave
            </button>
          </div>
        )}
      </div>
      
      <Header context={context} />
      <div className="grow flex relative overflow-hidden">
        <Code containerRef={containerRef} editorRef={editorRef} init={init} />
        {!isZen && panelPosition === 'right' && <VerticalPanel context={context} />}
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <HorizontalPanel context={context} />}
    </div>
  );
}
