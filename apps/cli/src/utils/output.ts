type OutputFormat = 'json' | 'text';
class Output {
  private format: OutputFormat = 'json';
  private quiet = false;
  setFormat(f: string) { this.format = f === 'text' ? 'text' : 'json'; }
  setQuiet(q: boolean) { this.quiet = !!q; }
  success(data: unknown, msg?: string) {
    if (this.format === 'json') console.log(JSON.stringify({ success: true, data, message: msg }, null, 2));
    else { if (msg && !this.quiet) console.log(`✓ ${msg}`); if (data !== undefined) console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : data); }
  }
  error(msg: string) { if (this.format === 'json') console.error(JSON.stringify({ success: false, error: msg }, null, 2)); else console.error(`✗ ${msg}`); }
  table(data: Array<Record<string, any>>, cols?: string[]) {
    if (this.format === 'json') { console.log(JSON.stringify({ success: true, data }, null, 2)); return; }
    if (!data.length) { console.log('(empty)'); return; }
    const c = cols || Object.keys(data[0]);
    console.log(c.join('\t')); console.log(c.map(() => '---').join('\t'));
    data.forEach(r => console.log(c.map(k => String(r[k] ?? '')).join('\t')));
  }
}
export const output = new Output();
