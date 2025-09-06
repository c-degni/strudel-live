import { io, Socket } from 'socket.io-client';
import { EditorView } from '@codemirror/view';
import { ChangeSet, Transaction } from '@codemirror/state';
import { User, Operation, OTEngine, generateUserId } from '@strudel/collab-types'

export interface CollabClientEvents {
    onUserJoined: (user: User) => void;
    onUserLeft: (userId: string) => void;
    onCursorUpdate: (userId: string, cursor: number, selection?: any) => void;
    onPlayStateChanged: (isPlaying: boolean, userId?: string) => void;
    onDocumentChanged: (document: string, operations: Operation[]) => void;
    onConnectionStatusChanged: (connected: boolean) => void;
}

export class StrudelCollabClient {
    private socket: Socket;
    private sessionId?: string;
    private userId?: string;
    private user?: User;
    private users = new Map<string, User>();
    private isPlaying = false;
    private pendingOperations: Operation[] = [];
    private editorView?: EditorView;

    constructor(
        private serverUrl: string = 'http://localhost:3001',
        private events: Partial<CollabClientEvents> = {}
    ) {
        this.socket = io(serverUrl);
        this.setupSocketHandlers();
    }

    private setupSocketHandlers() {
        this.socket.on('connect', () => {
            this.events.onConnectionStatusChanged?.(true);
        });

        this.socket.on('disconnect', () => {
            this.events.onConnectionStatusChanged?.(false);
        });

        this.socket.on('session-joined', (data: {
            sessionId: string,
            userId: string,
            user: User,
            document: string,
            users: User[],
            isPlaying: boolean
        }) => {
            this.sessionId = data.sessionId;
            this.userId = data.userId;
            this.user = data.user;
            this.isPlaying = data.isPlaying;

            this.users.clear();
            data.users.forEach(user => this.users.set(user.id, user));

            this.events.onDocumentChanged?.(data.document, []);
            this.events.onPlayStateChanged?.(data.isPlaying);
        });

        this.socket.on('user-joined', (data: { user: User }) => {
            this.users.set(data.user.id, data.user);
            this.events.onUserJoined?.(data.user);
        });
    
        this.socket.on('user-left', (data: { userId: string }) => {
            this.users.delete(data.userId);
            this.events.onUserLeft?.(data.userId);
        });
    
        this.socket.on('operation', (data: { operations: Operation[], userId: string, document: string }) => {
            if (data.userId !== this.userId) this.events.onDocumentChanged?.(data.document, data.operations);
        });

        this.socket.on('cursor-update', (data: { userId: string, cursor: number, selection?: any }) => {
            const user = this.users.get(data.userId);
            if (user) {
                user.cursor = data.cursor;
                user.selection = data.selection;
                this.events.onCursorUpdate?.(data.userId, data.cursor, data.selection);
            }
        });
    
        this.socket.on('play-state-changed', (data: { isPlaying: boolean, startedBy?: string, stoppedBy?: string }) => {
            this.isPlaying = data.isPlaying;
            this.events.onPlayStateChanged?.(data.isPlaying, data.startedBy || data.stoppedBy);
        });
    }

    async createSession(userName: string, initialCode: string = ''): Promise<string> {
        const response = await fetch(`${this.serverUrl}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName, initialCode })
        });

        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Failed to create session.');
        
        // Join created session
        this.socket.emit('join-session', {
            sessionId: data.sessionId,
            userName
        });

        return data.sessionId;
    }

    joinSession(sessionId: string, userName: string) {
        this.socket.emit('join-session', { sessionId, userName });
    }

    // CodeMirror changes to OT operations
    private changeSetToOperations(changeSet: ChangeSet, document: string): Operation[] {
        const operations: Operation[] = [];
        let pos: number = 0;

        changeSet.iterChanges((from, to, insert) => {
            // Keep chars before change, delete chars the change overwrites, insert new chars
            if (from > pos) operations.push({ type: 'retain', count: from - pos });
            if (to > from) operations.push({ type: 'delete', count: to - from });
            if (insert.toString().length > 0) operations.push({ type: 'insert', text: insert.toString() });
            pos = to;
        });

        // Keep remaining chars in doc
        if (pos < document.length) operations.push({ type: 'retain', count: document.length - pos });

        return operations;
    }
    
    // Apply operations to editor (entire doc is replaced here, may consider minimal span approaches later for more efficiency)
    applyOperations(operations: Operation[]) {
        if (!this.editorView) return;

        const document = this.editorView.state.doc.toString();
        const newDocument = OTEngine.apply(document, operations);

        if (newDocument !== document) {
            const changes = this.editorView.state.changes({
                from: 0,
                to: document.length,
                insert: newDocument
            });

            this.editorView.dispatch({
                changes,
                annotations: [Transaction.remote.of(true)]
            });
        }
    }

    sendOperation(changeSet: ChangeSet, document: string) {
        if (!this.sessionId || !this.userId || this.isPlaying) return;

        const operations = this.changeSetToOperations(changeSet, document);

        if (operations.length > 0) {
            this.socket.emit('operation', {
                sessionId: this.sessionId,
                userId: this.userId,
                operations
            });
        }
    }

    updateCursor(cursor: number, selection?: { from: number, to: number }) {
        if (!this.sessionId || !this.userId) return;

        this.socket.emit('cursor-update', {
            sessionId: this.sessionId,
            userId: this.userId,
            cursor,
            selection
        });
    }

    requestPlay() {
        if (!this.sessionId || !this.userId || this.isPlaying) return;

        this.socket.emit('play-request', {
            sessionId: this.sessionId,
            userId: this.userId
        });
    }

    requestStop() {
        if (!this.sessionId || !this.userId || !this.isPlaying) return;

        this.socket.emit('stop-request', {
            sessionId: this.sessionId,
            userId: this.userId
        });
    }

    setEditorView(view: EditorView) {
        this.editorView = view;
    }

    getUsers(): User[] {
        return Array.from(this.users.values()).filter(u => u.id !== this.userId);
    }
    
    getCurrentUser(): User | undefined {
        return this.user;
    }

    getPlayingState(): boolean {
        return this.isPlaying;
    }

    disconnect() {
        this.socket.disconnect();
    }
};