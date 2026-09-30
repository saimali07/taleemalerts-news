// Node 20+, no dependencies. Pulls study headlines from Google News RSS into Supabase.
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY;
if (!U || !K) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
const QUERIES = [ // edit freely: [search text, category]
  ['HEC scholarship Pakistan', 'Scholarship'],
  ['Ehsaas OR PEEF OR "need based" scholarship students Pakistan', 'Scholarship'],
  ['university admissions open Pakistan', 'Admission'],
  ['MDCAT OR ECAT OR "NUST NET" OR "entry test" Pakistan', 'Exam'],
  ['merit list university Pakistan', 'Merit List'],
  ['student internship OR scheme OR programme OR laptop scheme Pakistan', 'Opportunity'],
];
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? dec(m[1]) : ''; };
const rows = new Map();
for (const [q, category] of QUERIES) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:3d')}&hl=en-PK&gl=PK&ceid=PK:en`;
  try {
    const xml = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    for (const item of xml.split('<item>').slice(1)) {
      const link = tag(item, 'link'); if (!/^https?:\/\//.test(link)) continue;
      const source = tag(item, 'source');
      let title = tag(item, 'title'); if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
      const d = new Date(tag(item, 'pubDate'));
      rows.set(link, { title: title.slice(0, 300), url: link, source, category, published_at: isNaN(d) ? new Date().toISOString() : d.toISOString() });
    }
  } catch (e) { console.warn('feed failed:', q, e.message); }
}
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const batch = [...rows.values()];
if (batch.length) {
  const r = await fetch(`${U}/rest/v1/news?on_conflict=url`, { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(batch) });
  console.log('inserted/checked', batch.length, 'status', r.status, r.ok ? '' : await r.text());
}
const cutoff = new Date(Date.now() - 60 * 864e5).toISOString(); // keep 60 days
await fetch(`${U}/rest/v1/news?published_at=lt.${cutoff}`, { method: 'DELETE', headers: H });

