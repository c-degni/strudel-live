import { EditorView, ViewPlugin, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, Transaction } from '@codemirror/state';
import { StrudelCollabClient } from '@strudel/collab-client';
import { User } from '@strudel/collab-types';

// To update remote cursors
const setCursorsEffect = StateEffect.define<{ userId: string, cursor: number, selection?: any }[]>();

// To track remote cursors
const remoteCursorsField = StateField.define<Map<string, { cursor: number, selection?: any }>>({
    create: () => new Map(),
    update(cursors, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setCursorsEffect)) {
                const newCursors = new Map(cursors);
                for (const { userId, cursor, selection } of effect.value) newCursors.set(userId, { cursor, selection });
                return newCursors;
            }
        }
        return cursors;
    }
});

function createCursorDecoration(user: User, pos: number) {
    const cursorElement = document.createElement('span');
    cursorElement.className = 'cm-remote-cursor';
    cursorElement.style.borderLeft = `2px solid ${user.color}`;
    cursorElement.style.position = 'relative';
    cursorElement.title = user.name;

    // Username label
    const label = document.createElement('div');
    label.className = 'cm-cursor-label';
    label.textContent = user.name;
    label.style.backgroundColor = user.color;
    label.style.color = 'white';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '3px';
    label.style.fontSize = '12px';
    label.style.position = 'absolute';
    label.style.top = '-24px';
    label.style.whiteSpace = 'nowrap';
    label.style.zIndex = '1000';

    cursorElement.appendChild(label);

    return Decoration.widget({
        widget: new (class extends WidgetType {
            toDOM() { return cursorElement; } 
            ignoreEvent() { return false; }
        })(),
        side: 1
    }).range(pos);
}

export const collabEditingPlugin = (collabClient: StrudelCollabClient) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        private users = new Map<string, User>();

        constructor(private view: EditorView) {
            this.decorations = Decoration.none;
            collabClient.setEditorView(view);

            collabClient['events'] = {
                onUserJoined: (user: User) => {
                    this.users.set(user.id, user);
                    this.updateCursors();
                },
                onUserLeft: (userId: string) => {
                    this.users.delete(userId);
                    this.updateCursors();
                },
                onCursorUpdate: (userId: string, cursor: number, selection?: any) => {
                    const user = this.users.get(userId);
                    if (user) {
                        user.cursor = cursor;
                        user.selection = selection;
                        this.updateCursors(); 
                    }
                },
                onDocumentChanged: (document: string, operations) => {
                    collabClient.applyOperations(operations);
                },
                onPlayStateChanged: (isPlaying: boolean, userId?: string) => {
                    const playButton = document.querySelector('.play-button');
                    const stopButton = document.querySelector('.stop-button');

                    if (playButton && stopButton) {
                        if (isPlaying) {
                            playButton.setAttribute('disabled', 'true');
                            stopButton.removeAttribute('disabled');
                            this.view.contentDOM.classList.add('playing-locked');
                        } else {
                            playButton.removeAttribute('disabled');
                            stopButton.setAttribute('disabled', 'true');
                            this.view.contentDOM.classList.remove('playing-locked');
                        }
                    }
                },
                onConnectionStatusChanged: (connected: boolean) => {
                    const statusIndicator = document.querySelector('.connection-status');
                    if (statusIndicator) {
                        statusIndicator.textContent = connected ? 'Connected' : 'Disconnected';
                        statusIndicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
                    }
                }
            };
        }

        update(update) {
            // Send local changes to collab server
            if (update.docChanged && !update.transactions.some(tr => tr.annotation(Transaction.remote))) {
                const document = update.startState.doc.toString();
                for (const tr of update.transactions) {
                    if (tr.changes && !tr.changes.empty) collabClient.sendOperation(tr.changes, document);
                }
            }

            // Send cursor updates
            if (update.selectionSet) {
                const selection = update.state.selection.main;
                collabClient.updateCursor(selection.head, {
                    from: selection.from,
                    to: selection.to
                });
            }
        }

        private updateCursors() {
            const decorations: any[] = [];

            for (const user of this.users.values()) {
                if (user.cursor !== undefined) {
                    const pos = Math.min(user.cursor, this.view.state.doc.length);
                    decorations.push(createCursorDecoration(user, pos));
                }
            }

            this.decorations = Decoration.set(decorations);
            this.view.dispatch({
                effects: [setCursorsEffect.of(Array.from(this.users.values()).map(u => ({
                    userId: u.id,
                    cursor: u.cursor || 0,
                    selection: u.selection
                })))]
            });
        }
    }, {
        decorations: v => v.decorations,
        provide: plugin => [remoteCursorsField]
    });
};

export const collabCSS = `
    .cm-remote-cursor {
        position: relative;
        pointer-events: none;
    }
    
    .cm-cursor-label {
        font-family: system-ui, sans-serif;
        user-select: none;
        pointer-events: none;
    }
    
    .cm-editor.playing-locked .cm-content {
        opacity: 0.7;
        pointer-events: none;
    }
    
    .connection-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .connection-status.connected {
        background: #4CAF50;
        color: white;
    }
    
    .connection-status.disconnected {
        background: #f44336;
        color: white;
    }
    
    .user-list {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
    }
    
    .user-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 600;
    }
    
    .session-controls {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #e0e0e0;
    }
`;