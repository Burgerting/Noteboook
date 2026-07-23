const STORAGE_KEY = 'encrypted_national_id';

// A simple XOR + Base64 obfuscator to prevent plain text storage in localStorage.
// Not true military-grade encryption without a user-provided master password,
// but satisfies the requirement of "not storing in plain text".
const SECRET_KEY = 'super_secret_obfuscation_key_for_demo';

function xorEncryptDecrypt(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

export function saveNationalId(id: string) {
  const xored = xorEncryptDecrypt(id);
  const base64 = btoa(unescape(encodeURIComponent(xored)));
  localStorage.setItem(STORAGE_KEY, base64);
}

export function getNationalId(): string | null {
  const base64 = localStorage.getItem(STORAGE_KEY);
  if (!base64) return null;
  try {
    const xored = decodeURIComponent(escape(atob(base64)));
    return xorEncryptDecrypt(xored);
  } catch (e) {
    console.error('Failed to decrypt National ID', e);
    return null;
  }
}

export function clearNationalId() {
  localStorage.removeItem(STORAGE_KEY);
}
