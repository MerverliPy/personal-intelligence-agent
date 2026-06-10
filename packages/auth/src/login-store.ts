import { randomBytes } from 'node:crypto';

/**
 * Data stored alongside a login transaction (state → verifier mapping).
 */
export interface LoginTransactionData {
  /** PKCE code verifier for the authorization code exchange. */
  codeVerifier: string;
  /** OIDC nonce parameter for replay protection. */
  nonce: string;
  /** The redirect URI used to initiate the flow. */
  redirectUri: string;
  /** Where to redirect the user after successful login (state parameter). */
  returnUrl?: string;
}

/**
 * Interface for storing and consuming short-lived login transaction state.
 *
 * Implementations:
 * - `InMemoryLoginTransactionStore` — for development/testing (process-local)
 * - `RedisLoginTransactionStore` — for production (Redis-backed, survives restarts)
 */
export interface LoginTransactionStore {
  /**
   * Stores login transaction data keyed by the OAuth2 `state` parameter.
   * Data expires after `ttlSeconds`.
   */
  create(state: string, data: LoginTransactionData, ttlSeconds: number): Promise<void>;

  /**
   * Atomically retrieves and deletes the transaction data for a given state.
   * Returns `null` if the state does not exist or has expired.
   */
  consume(state: string): Promise<LoginTransactionData | null>;
}

// ---------------------------------------------------------------------------
// In-Memory implementation
// ---------------------------------------------------------------------------

interface StoredTransaction {
  data: LoginTransactionData;
  expiresAt: number;
}

/**
 * In-memory login transaction store for development and testing.
 * Data is lost on process restart.
 */
export class InMemoryLoginTransactionStore implements LoginTransactionStore {
  private readonly store = new Map<string, StoredTransaction>();

  async create(state: string, data: LoginTransactionData, ttlSeconds: number): Promise<void> {
    this.store.set(state, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async consume(state: string): Promise<LoginTransactionData | null> {
    const entry = this.store.get(state);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.store.delete(state);
      return null;
    }

    // Atomic consume: delete after read
    this.store.delete(state);
    return entry.data;
  }
}

// ---------------------------------------------------------------------------
// Redis implementation
// ---------------------------------------------------------------------------

/**
 * A minimal Redis client interface covering only the operations needed
 * for login transaction storage. Accepts any Redis client that satisfies
 * this contract (ioredis, node-redis, etc.).
 */
export interface RedisClient {
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

/**
 * Redis-backed login transaction store for production use.
 */
export class RedisLoginTransactionStore implements LoginTransactionStore {
  private readonly prefix: string;

  constructor(
    private readonly redis: RedisClient,
    prefix = 'oidc:login:',
  ) {
    this.prefix = prefix;
  }

  async create(state: string, data: LoginTransactionData, ttlSeconds: number): Promise<void> {
    const key = this.prefix + state;
    const value = JSON.stringify(data);
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async consume(state: string): Promise<LoginTransactionData | null> {
    const key = this.prefix + state;
    const raw = await this.redis.get(key);
    if (!raw) return null;

    // Delete immediately to prevent replay — this is a consume operation
    await this.redis.del(key);

    try {
      return JSON.parse(raw) as LoginTransactionData;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random OAuth2 state parameter.
 */
export function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generates a cryptographically random OIDC nonce.
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex');
}
