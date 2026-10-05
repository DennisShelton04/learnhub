/** Audio formats browsers record with MediaRecorder, identified by their file signature. */
const formats = [
  { type: "audio/webm", ext: "webm", matches: (b: Uint8Array) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { type: "audio/ogg", ext: "ogg", matches: (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 4)) === "OggS" },
  { type: "audio/mp4", ext: "m4a", matches: (b: Uint8Array) => String.fromCharCode(...b.subarray(4, 8)) === "ftyp" },
] as const;

export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_MS = 5 * 60 * 1000;

/** Detects the format from the bytes themselves, not the client-supplied type. */
export function detectAudioFormat(bytes: Uint8Array) {
  return formats.find((f) => bytes.length >= 12 && f.matches(bytes)) ?? null;
}
