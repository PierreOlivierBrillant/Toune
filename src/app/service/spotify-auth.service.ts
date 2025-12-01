import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { generateRandomString } from '../util/string-util';

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string; height: number; width: number }>;
  followers: { total: number };
  country: string;
}

@Injectable({ providedIn: 'root' })
export class SpotifyAuthService {
  token = signal<string | null>(null);
  expiresAt = signal<number | null>(null);
  isAuthenticated = signal<boolean>(false);
  userProfile = signal<SpotifyUser | null>(null);

  constructor() {
    this.restoreTokensFromStorage();
  }

  /**
   * Génère un code challenge pour PKCE à partir du code verifier (SHA-256)
   * Utilise crypto.subtle si disponible (HTTPS), sinon fallback vers une implémentation JS pure
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    // crypto.subtle n'est disponible qu'en contexte sécurisé (HTTPS ou localhost)
    if (crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await crypto.subtle.digest('SHA-256', data);

      return this.base64UrlEncode(new Uint8Array(digest));
    }

    // Fallback: implémentation SHA-256 en JS pur pour contexte HTTP
    console.warn(
      'crypto.subtle not available (HTTP context). Using JS fallback for SHA-256.'
    );
    const hash = this.sha256(codeVerifier);
    return this.base64UrlEncode(hash);
  }

  /**
   * Encode en base64 URL-safe
   */
  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Implémentation SHA-256 en JavaScript pur (fallback pour HTTP)
   */
  private sha256(message: string): Uint8Array {
    const K: number[] = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
    const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
    const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
    const sigma0 = (x: number) => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
    const sigma1 = (x: number) => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
    const gamma0 = (x: number) => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
    const gamma1 = (x: number) => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

    // Convert string to bytes
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message);
    const msgLen = msgBytes.length;
    const bitLen = msgLen * 8;

    // Calculate padded length: message + 1 byte (0x80) + padding + 8 bytes (length)
    // Total must be multiple of 64 bytes (512 bits)
    const totalLen = Math.ceil((msgLen + 9) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(msgBytes);
    padded[msgLen] = 0x80;

    // Append length in bits as 64-bit big-endian at the end
    const view = new DataView(padded.buffer);
    // For messages < 2^32 bits, we only need the low 32 bits
    view.setUint32(totalLen - 4, bitLen, false);

    // Initialize hash values
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    // Process each 512-bit (64-byte) chunk
    for (let i = 0; i < totalLen; i += 64) {
      const w = new Uint32Array(64);

      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + j * 4, false);
      }

      for (let j = 16; j < 64; j++) {
        w[j] = (gamma1(w[j - 2]) + w[j - 7] + gamma0(w[j - 15]) + w[j - 16]) >>> 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

      for (let j = 0; j < 64; j++) {
        const t1 = (h + sigma1(e) + ch(e, f, g) + K[j] + w[j]) >>> 0;
        const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }

      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    // Produce the final hash value (big-endian)
    const result = new Uint8Array(32);
    const resultView = new DataView(result.buffer);
    resultView.setUint32(0, h0, false);
    resultView.setUint32(4, h1, false);
    resultView.setUint32(8, h2, false);
    resultView.setUint32(12, h3, false);
    resultView.setUint32(16, h4, false);
    resultView.setUint32(20, h5, false);
    resultView.setUint32(24, h6, false);
    resultView.setUint32(28, h7, false);

    return result;
  }

  private restoreTokensFromStorage(): void {
    try {
      const storedToken = localStorage.getItem('spotify_access_token');
      const storedExpiresAt = localStorage.getItem('spotify_token_expires_at');
      const storedIsAuthenticated = localStorage.getItem('spotify_is_authenticated');

      if (storedToken && storedExpiresAt && storedIsAuthenticated === 'true') {
        const expiresAt = parseInt(storedExpiresAt, 10);

        // Check if token is still valid
        if (expiresAt > Date.now()) {
          this.token.set(storedToken);
          this.expiresAt.set(expiresAt);
          this.isAuthenticated.set(true);
          this.loadUserProfile();
        } else {
          // Token expired, clear storage
          this.clearToken();
        }
      }
    } catch (error) {
      // If there's any error reading from storage, clear everything
      this.clearToken();
    }
  }

  async loadUserProfile(): Promise<void> {
    if (!this.token()) {
      return;
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${this.token()}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        this.userProfile.set(user);
      }
    } catch (error) {
      console.error('Failed to load user profile', error);
    }
  }

  login(): void {
    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(64);
    const scope =
      'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state';

    // Store state and code verifier in localStorage for validation
    localStorage.setItem('spotify_auth_state', state);
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const redirectUri = `${window.location.origin}/Toune/callback`;

    // Generate code challenge asynchronously then redirect
    this.generateCodeChallenge(codeVerifier).then((codeChallenge) => {
      const params = new URLSearchParams();
      params.set('response_type', 'code');
      params.set('client_id', environment.clientId);
      params.set('scope', scope);
      params.set('redirect_uri', redirectUri);
      params.set('state', state);
      params.set('code_challenge_method', 'S256');
      params.set('code_challenge', codeChallenge);
      params.set('show_dialog', 'true');

      window.location.href = `${environment.spotifyApiUrl}/authorize?${params.toString()}`;
    });
  }

  async handleCallback(code: string, state: string): Promise<void> {
    // Validate state parameter
    const storedState = localStorage.getItem('spotify_auth_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    if (state !== storedState) {
      throw new Error('State validation failed');
    }

    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');

    // Prepare form data with PKCE code verifier
    const formData = new URLSearchParams();
    formData.set('client_id', environment.clientId);
    formData.set('grant_type', 'authorization_code');
    formData.set('code', code);
    formData.set('redirect_uri', `${window.location.origin}/Toune/callback`);
    formData.set('code_verifier', codeVerifier);

    const res = await fetch(`${environment.spotifyApiUrl}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Spotify token request failed:', res.status, errorText);
      throw new Error(`Spotify token request failed: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    };

    this.token.set(data.access_token);
    this.expiresAt.set(Date.now() + data.expires_in * 1000 - 60_000);
    this.isAuthenticated.set(true);
    this.loadUserProfile();

    // Store tokens in localStorage for persistence
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem(
      'spotify_token_expires_at',
      (Date.now() + data.expires_in * 1000 - 60_000).toString()
    );
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    localStorage.setItem('spotify_is_authenticated', 'true');
  }

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const formData = new URLSearchParams();
    formData.set('grant_type', 'refresh_token');
    formData.set('refresh_token', refreshToken);
    formData.set('client_id', environment.clientId);

    const res = await fetch(`${environment.spotifyApiUrl}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Spotify token refresh failed:', res.status, errorText);
      throw new Error(`Spotify token refresh failed: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    };

    this.token.set(data.access_token);
    this.expiresAt.set(Date.now() + data.expires_in * 1000 - 60_000);

    // Update tokens in localStorage
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem(
      'spotify_token_expires_at',
      (Date.now() + data.expires_in * 1000 - 60_000).toString()
    );

    // Update refresh token if provided
    if (data.refresh_token) {
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }

    return data.access_token;
  }

  async getValidToken(): Promise<string> {
    const now = Date.now();
    const expires = this.expiresAt();

    if (this.token() && expires && now < expires) {
      return this.token()!;
    }

    // Try to refresh token
    try {
      return await this.refreshToken();
    } catch (error) {
      // If refresh fails, user needs to login again
      this.clearToken();
      throw new Error('Authentication required');
    }
  }

  clearToken(): void {
    this.token.set(null);
    this.expiresAt.set(null);
    this.isAuthenticated.set(false);
    this.userProfile.set(null);

    // Clear all stored tokens
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_at');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_is_authenticated');
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_code_verifier');
  }

  logout(): void {
    this.clearToken();
  }
}
