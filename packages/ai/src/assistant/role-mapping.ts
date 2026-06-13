// ---------------------------------------------------------------------------
// Bidirectional message-role mapping (P3-T05)
// ---------------------------------------------------------------------------
// The database stores roles as USER | ASSISTANT | SYSTEM_NOTE | TOOL.
// The model gateway uses user | assistant | system | tool.
// These helpers provide a single point of truth for conversion.
// ---------------------------------------------------------------------------

import type { MessageRole } from '@pia/db';
import type { Message } from '../gateway/index.js';

/**
 * Maps a database MessageRole to a gateway Message.role.
 */
export function mapDbRoleToGateway(role: MessageRole): Message['role'] {
  switch (role) {
    case 'USER':
      return 'user';
    case 'ASSISTANT':
      return 'assistant';
    case 'SYSTEM_NOTE':
      return 'system';
    case 'TOOL':
      return 'tool';
  }
}

/**
 * Maps a gateway Message.role to a database MessageRole.
 */
export function mapGatewayRoleToDb(role: Message['role']): MessageRole {
  switch (role) {
    case 'user':
      return 'USER';
    case 'assistant':
      return 'ASSISTANT';
    case 'system':
      return 'SYSTEM_NOTE';
    case 'tool':
      return 'TOOL';
  }
}
