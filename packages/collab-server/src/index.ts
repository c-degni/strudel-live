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
    private:
        io: Server;
        sessions = new Map<string, ServerSession>();
        userSessions = new Map<string, string>(); // userId -> sessionId
    
    public:
        null;
};