// Big-endian byte cursors for the PSD codec. PSD is big-endian throughout,
// and DataView's per-call endianness flag is the kind of thing that gets
// forgotten once in forty reads; these two classes forget it for nobody.

/** Thrown for a file that is not a PSD, or a PSD this reader does not do.
 *  The message is user-facing — it goes straight into the import toast. */
export class PsdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PsdError";
  }
}

export class ByteReader {
  pos = 0;
  private readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  get length(): number {
    return this.bytes.length;
  }
  /** Every read goes through here, so a truncated file is one error, not a
   *  RangeError from somewhere inside DataView. */
  need(n: number): void {
    if (n < 0 || this.pos + n > this.bytes.length) {
      throw new PsdError("This PSD file ends early — it may be truncated.");
    }
  }
  u8(): number {
    this.need(1);
    return this.bytes[this.pos++];
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }
  ascii(n: number): string {
    this.need(n);
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.bytes[this.pos + i]);
    this.pos += n;
    return s;
  }
  /** A view (no copy) of the next `n` bytes. */
  take(n: number): Uint8Array {
    this.need(n);
    const v = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }
  skip(n: number): void {
    this.need(n);
    this.pos += n;
  }
  seek(pos: number): void {
    if (pos < 0 || pos > this.bytes.length) {
      throw new PsdError("This PSD file ends early — it may be truncated.");
    }
    this.pos = pos;
  }
}

export class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  private view = new DataView(this.buf.buffer);
  private len = 0;

  get length(): number {
    return this.len;
  }
  private grow(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number): void {
    this.grow(1);
    this.buf[this.len++] = v & 0xff;
  }
  u16(v: number): void {
    this.grow(2);
    this.view.setUint16(this.len, v);
    this.len += 2;
  }
  i16(v: number): void {
    this.grow(2);
    this.view.setInt16(this.len, v);
    this.len += 2;
  }
  u32(v: number): void {
    this.grow(4);
    this.view.setUint32(this.len, v);
    this.len += 4;
  }
  i32(v: number): void {
    this.grow(4);
    this.view.setInt32(this.len, v);
    this.len += 4;
  }
  /** Patch a u32 written earlier — how every "length of what follows" field
   *  gets its value after the content is known. */
  patchU32(at: number, v: number): void {
    this.view.setUint32(at, v);
  }
  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i) & 0x7f);
  }
  bytes(b: Uint8Array): void {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  zeros(n: number): void {
    this.grow(n);
    this.buf.fill(0, this.len, this.len + n);
    this.len += n;
  }
  /** Pad with zeros so the length is a multiple of `to`. */
  align(to: number): void {
    const rem = this.len % to;
    if (rem) this.zeros(to - rem);
  }
  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}
