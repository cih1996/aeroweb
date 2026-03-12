import * as http from 'http';
interface ApiRes<T = unknown> { success: boolean; data?: T; error?: string; }
class BrowserClient {
  private host = process.env.POLYWEB_HOST || '127.0.0.1';
  private port = parseInt(process.env.POLYWEB_PORT || '9528', 10);
  async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const r = http.request({ hostname: this.host, port: this.port, path: `/api${path}`, method,
        headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
      }, res => {
        let result = ''; res.on('data', c => result += c);
        res.on('end', () => { try { const j: ApiRes<T> = JSON.parse(result); j.success ? resolve(j.data as T) : reject(new Error(j.error || 'Error')); } catch { reject(new Error(`Invalid: ${result}`)); } });
      });
      r.on('error', e => reject(new Error(`Connection failed: ${e.message}`)));
      if (data) r.write(data); r.end();
    });
  }
  createInstance(c: { id: string; name: string }) { return this.req('POST', '/instance', c); }
  listInstances() { return this.req<Array<{ id: string; name: string; status: string; pageCount: number }>>('GET', '/instances'); }
  closeInstance(id: string) { return this.req('DELETE', `/instance/${id}`); }
  newPage(i: string, url: string, o?: { background?: boolean }) { return this.req('POST', `/instance/${i}/page`, { url, ...o }); }
  listPages(i: string) { return this.req<Array<{ id: string; url: string; title: string; active: boolean }>>('GET', `/instance/${i}/pages`); }
  closePage(i: string, p: string) { return this.req('DELETE', `/instance/${i}/page/${p}`); }
  navigate(i: string, p: string, o: { type: string; url?: string }) { return this.req('POST', `/instance/${i}/page/${p}/navigate`, o); }
  takeSnapshot(i: string, p: string) { return this.req('GET', `/instance/${i}/page/${p}/snapshot`); }
  takeScreenshot(i: string, p: string, o?: { fullPage?: boolean }) { return this.req('POST', `/instance/${i}/page/${p}/screenshot`, o); }
  click(i: string, p: string, uid: string) { return this.req('POST', `/instance/${i}/page/${p}/click`, { uid }); }
  fill(i: string, p: string, uid: string, v: string) { return this.req('POST', `/instance/${i}/page/${p}/fill`, { uid, value: v }); }
  evaluate(i: string, p: string, s: string) { return this.req('POST', `/instance/${i}/page/${p}/evaluate`, { function: s }); }
  waitFor(i: string, p: string, t: string[], to?: number) { return this.req('POST', `/instance/${i}/page/${p}/wait`, { text: t, timeout: to }); }
}
export const client = new BrowserClient();
