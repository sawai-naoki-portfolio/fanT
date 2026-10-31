/** Hex SHA-256, the hash content/ records for every asset (CNT-02). */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Saves bytes or text as a download. */
export function download(name: string, data: Uint8Array<ArrayBuffer> | string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function readFile(file: File): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await file.arrayBuffer());
}
