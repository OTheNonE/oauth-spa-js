
function base64URLEncode(array: ArrayBuffer): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(array)))
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array)
    return base64URLEncode(array)
}

async function sha256(buffer: ArrayBuffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer)
    return hash;
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hash = await sha256(data)
    return base64URLEncode(hash)
}