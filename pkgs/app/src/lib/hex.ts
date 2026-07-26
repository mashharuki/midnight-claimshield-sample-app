export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (value: string): Uint8Array => {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error("Invalid hexadecimal value");
  }
  return Uint8Array.from(
    normalized.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
};
