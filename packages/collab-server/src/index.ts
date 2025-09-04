import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Session, User, CollabMessage, OTEngine, Operation, generateSessionId, generateUserId, generateUserColor } from '@strudel/collab-types';

interface ServerSession extends Omit<Session, 'users'> {
    users: Map<string, User>;
    operations: Operation[][];
    operationHistory: { ops: Operation[], userId:string, timestamp: number }[];
}

class StrudelCollabServer {
    private io: Server;
    private sessions = new Map<string, ServerSession>();
    private userSessions = new Map<string, string>(); // userId -> sessionId
    
    constructor(port: number = 3001) {
        const app = express();
        app.use(cors());
        app.use(express.json());

        // REST endpoints for session management
        app.post('/sessions', this.createSession.bind(this));
        app.get('/sessions:id', this.getSession.bind(this));

        const server = createServer(app);
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.setupSocketHandlers();

        server.listen(port, () => {
            console.log(`Strudel collab server running on port ${port}`);
        });
    }

    private createSession(req: express.Request, res: express.Response) {
        const { userName, initialCode = '' } = req.body;
        const sessionId = generateSessionId();
        const userId = generateUserId();

        const session: ServerSession = {
            id: sessionId,
            createdAt: new Date(),
            createdBy: userId,
            users: new Map(),
            document: initialCode,
            isPlaying: false,
            operations: [],
            operationHistory: []
        };

        const user: User = {
            id: userId,
            name: userName,
            color: generateUserColor(),
            cursor: 0
        };

        session.users.set(userId, user);
        this.sessions.set(sessionId, session);
        this.userSessions.set(userId, sessionId);
        
        res.json({ sessionId, userId, user });
    }

    private getSession(req: express.Request, res: express.Response) {
        const sessionId = req.params.id;
        const session = this.sessions.get(sessionId);

        if (!session) return res.status(404).json({ error: 'Session not found.' });

        res.json({
            id: session.id,
            document: session.document,
            isPlaying: session.isPlaying,
            users: Array.from(session.users.values())            
        });
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            socket.on('join-session', (data: { sessionId: string, userName: string }) => {
                const { sessionId, userName } = data;
                const session = this.sessions.get(sessionId);

                if (!session) {
                    socket.emit('error', { message: 'Session not found.' });
                    return;
                }

                const userId = generateUserId();
                const user: User = {
                    id: userId,
                    name: userName,
                    color: generateUserColor(),
                    cursor: 0
                };

                session.user.set(userId, user);
                this.userSessions.set(userId, sessionId);
                socket.join(sessionId);

                // Update new user to current session state
                socket.emit('session-joined', {
                    sessionId,
                    userId,
                    user,
                    document: session.document,
                    users: Array.from(session.users.values()),
                    isPlaying: session.isPlaying
                });
                
                // For notifying others in session
                socket.to(sessionId).emit('user-joined', { user });
            });

            socket.on('operation', (data: { sessionId: string, userId: string, operations: Operation[] }) => {
                const { sessionId, userId, operations } = data;
                const session = this.sessions.get(sessionId);

                // No acceptable operations during playback (may change this later to be more robust)
                if (!session || session.isPlaying) return;

                // Transform against all operation after this user's last operation
                let transformedOps: Operation[] = operations;
                for  (const entry of session.operationHistory) {
                    if (entry.userId !== userId) {
                        const [transformed, _] = OTEngine.transform(transformedOps, entry.ops);
                        transformedOps = transformed;
                    }
                }

                const newDocument = OTEngine.apply(session.document, transformedOps);
                session.document = newDocument;

                session.operationHistory.push({
                    ops: transformedOps,
                    userId,
                    timestamp: Date.now()
                });

                // Broadcast changes to other users in session
                socket.to(sessionId).emit('operation', {
                    operations: transformedOps,
                    userId,
                    document: newDocument
                });
            });

            socket.on('cursor-update', (data: { sessionId: string, userId: string, cursor: number, selection?: any }) => {
                const { sessionId, userId, cursor, selection } = data;
                const session = this.sessions.get(sessionId);

                if (session && session.users.has(userId)) {
                    const user = session.users.get(userId);
                    user.cursor = cursor;
                    user.selection = selection;

                    socket.to(sessionId).emit('cursor-update', { userId, cursor, selection });
                }
            });

            socket.on('play-request', (data: { sessionId: string, userId: string }) => {
                const { sessionId, userId } = data;
                const session = this.sessions.get(sessionId);

                if (session && !session.isPlaying) {
                    session.isPlaying = true;
                    session.playStartedBy = userId;

                    this.io.to(sessionId).emit('play-state-changed', {
                        isPlaying: true,
                        startedBy: userId
                    });
                }
            });

            socket.on('stop-request', (data: { sessionId: string, userId: string }) => {
                const { sessionId, userId } = data;
                const session = this.sessions.get(sessionId);

                if (session && session.isPlaying) {
                    session.isPlaying = false;
                    session.playStartedBy = undefined;

                    this.io.to(sessionId).emit('play-state-changed', {
                        isPlaying: false,
                        stoppedBy: userId
                    });
                }
            });

            socket.on(`disconnect`, () => {
                for (const [userId, sessionId] of this.userSessions.entries()) {
                    const session = this.sessions.get(sessionId);
                    if (session && session.users.has(userId)) {
                        session.users.delete(userId);
                        this.userSessions.delete(userId);

                        // Notify other users in session
                        socket.to(sessionId).emit('user-left', { userId });

                        if (session.users.size === 0) this.sessions.delete(sessionId);
                        break;
                    }
                }
            });
        });
    }
};

new StrudelCollabServer(process.env.PORT ? parseInt(process.env.PORT) : 3001);
export default StrudelCollabServer;