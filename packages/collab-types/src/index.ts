export interface User {
    id: string;
    name: string;
    color: string;
    cursor?: number;
    selection?: { from: number; to: number };
}

export interface Session {
    id: string;
    createdAt: Date;
    createdBy: string;
    users: Map<string, User>;
    document: string;
    isPlaying: boolean;
    playStartedBy?: string;
}

// Operational Transform (OT)
export type Operation = RetainOp | InsertOp | DeleteOp;

export interface RetainOp {
    type: 'retain';
    count: number;
}

export interface InsertOp {
    type: 'insert';
    text: string;
}

export interface DeleteOp {
    type: 'delete';
    count: number;
}

// May wrap all socket messages in this format later instead of directly using socket.io events
// export interface CollabMessage {
//     type: 'operation' | 'cursor' | 'user-join' | 'user-leave' | 'play-state';
//     sessionId: string;
//     userId: string;
//     data: any;
//     timestamp: number;
// }

export class OTEngine {
    static transform(op1: Operation[], op2: Operation[]): [Operation[], Operation[]] {
        let i: number = 0, j: number = 0;
        let pos1: number = 0, pos2: number = 0;
        const result1: Operation[] = [];
        const result2: Operation[] = [];

        while (i < op1.length && j < op2.length) {
            const o1 = op1[i];
            const o2 = op2[j];

            if (o1.type === 'retain' && o2.type === 'retain') {
                const count = Math.min(o1.count, o2.count);
                result1.push({ type: 'retain', count });
                result2.push({ type: 'retain', count });

                if (o1.count > count) {
                    op1[i] = { type: 'retain', count: o1.count - count };
                } else {
                    i++;
                }

                if (o2.count > count) {
                    op2[j] = { type: 'retain', count: o2.count - count };
                } else {
                    j++;
                }

                pos1 += count;
                pos2 += count;
            } else if (o1.type === 'insert') {
                result1.push(o1);
                result2.push({ type: 'retain', count: o1.text.length });
                i++;
            } else if (o2.type === 'insert') {
                result1.push({ type: 'retain', count: o2.text.length });
                result2.push(o2);
                j++;
            } else if (o1.type === 'delete' && o2.type === 'delete') {
                const count = Math.min(o1.count, o2.count);

                if (o1.count > count) {
                    op1[i] = { type: 'delete', count: o1.count - count };
                } else {
                    i++;
                }
                
                if (o2.count > count) {
                    op2[j] = { type: 'delete', count: o2.count - count };
                } else {
                    j++;
                }
            } else if (o1.type === 'delete') {
                result1.push(o1);
                pos2 += o1.count;
                i++;
            } else if (o2.type === 'delete') {
                result2.push(o2);
                pos1 += o2.count;
                j++;
            }
        }

        // Remaining operations
        while (i < op1.length) {
            result1.push(op1[i]);
            i++;
        }
        
        while (j < op2.length) {
            result2.push(op2[j]);
            j++;
        }

        return [result1, result2];
    }

    static apply(doc: string, ops: Operation[]): string {
        let result: string = '';
        let pos: number = 0;

        for (const op of ops) {
            switch (op.type) {
                case 'retain':
                    result += doc.slice(pos, pos + op.count);
                    pos += op.count;
                    break;
                case 'insert':
                    result += op.text;
                    break;
                case 'delete':
                    pos += op.count;
                    break;
            }
        }

        result += doc.slice(pos);
        return result;
    }
};

export function generateUserId(): string {
    return Math.random().toString(36).substring(2, 11);
}

export function generateSessionId(): string {
    return Math.random().toString(36).substring(2, 14);
}

export function generateUserColor(): string {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F06292'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

