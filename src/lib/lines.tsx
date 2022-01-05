export function lines(text: string, lines: number[]) {
  if (!lines || lines.length === 0) return text;

  const [from, to] = lines;
  const textLines = text.split(/\n/);

  if (!to) return textLines[from - 1];

  let buffer = [];
  for (let i = from; i <= to; i++) {
    buffer.push(textLines[i - 1]);
  }
  return buffer.join("\n");
}
