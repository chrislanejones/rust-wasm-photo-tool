// A pin's drawn label, mirroring the Rust `pin_label`: the sequence index as
// digits (label kind 0), or a spreadsheet-style letter sequence (kind 1):
// 1→A … 26→Z, 27→AA, 28→AB…
export function pinLabelText(n: number, labelKind?: number): string {
  if (labelKind !== 1) return String(n);
  if (n <= 0) return "?";
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
