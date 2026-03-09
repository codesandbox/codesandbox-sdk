/**
 * Base32 encoding utilities following RFC 4648 standard
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a string to base32 (RFC 4648)
 * @param input - The string to encode
 * @param lowercase - Whether to return lowercase encoding (default: true)
 * @param removePadding - Whether to remove padding characters (default: true)
 * @returns Base32 encoded string
 */
export function base32Encode(
  input: string,
  lowercase: boolean = true,
  removePadding: boolean = true
): string {
  const buffer = Buffer.from(input, "utf-8");
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  // Add padding
  while (output.length % 8 !== 0) {
    output += "=";
  }

  // Remove padding if requested
  if (removePadding) {
    output = output.replace(/=+$/, "");
  }

  // Convert to lowercase if requested
  if (lowercase) {
    output = output.toLowerCase();
  }

  return output;
}
