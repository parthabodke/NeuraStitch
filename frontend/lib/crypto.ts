// frontend/lib/crypto.ts

const SALT = new Uint8Array([10, 24, 99, 102, 23, 76, 219, 88, 12, 54, 9, 3, 21, 6, 8, 101]); // Fixed salt for beta simplicity
const IV_LEN = 12;

async function getKey(pin: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptKey(plaintext: string, pin: string): Promise<string> {
  if (!plaintext) return "";
  try {
    const key = await getKey(pin);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );
    
    // Combine IV and ciphertext into a single array
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to base64
    let binary = "";
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.error("Encryption failed:", err);
    throw new Error("Failed to encrypt API key.");
  }
}

export async function decryptKey(base64Ciphertext: string, pin: string): Promise<string> {
  if (!base64Ciphertext) return "";
  try {
    const key = await getKey(pin);
    const binaryString = window.atob(base64Ciphertext);
    const len = binaryString.length;
    const combined = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    
    const iv = combined.slice(0, IV_LEN);
    const ciphertext = combined.slice(IV_LEN);
    
    const dec = new TextDecoder();
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return dec.decode(plaintext);
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Incorrect PIN or invalid key data.");
  }
}
