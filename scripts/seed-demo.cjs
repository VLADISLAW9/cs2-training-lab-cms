const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const samples = [
  { name: 'Mirage', slug: 'mirage', zones: ['T Spawn', 'A Site', 'Mid'], grenades: [
    { title: 'Демо: дым на A', slug: 'demo-a-smoke', grenadeType: 'smoke', side: 't', from: 0, target: 1 },
    { title: 'Демо: флешка в мид', slug: 'demo-mid-flash', grenadeType: 'flash', side: 't', from: 0, target: 2 },
  ] },
  { name: 'Inferno', slug: 'inferno', zones: ['T Spawn', 'Banana', 'B Site'], grenades: [
    { title: 'Демо: дым на B', slug: 'demo-b-smoke', grenadeType: 'smoke', side: 't', from: 1, target: 2 },
    { title: 'Демо: молотов на банан', slug: 'demo-banana-molotov', grenadeType: 'molotov', side: 'ct', from: 2, target: 1 },
  ] },
];

async function main() {
  const app = createStrapi(await compileStrapi());
  try {
    await app.load();
    async function ensure(uid, filters, data) {
      const documents = app.documents(uid);
      const existing = await documents.findFirst({ status: 'draft', filters });
      if (existing) { console.log(`Exists: ${data.title || data.name}`); return existing; }
      const result = await documents.create({ status: 'draft', data });
      console.log(`Created draft: ${data.title || data.name}`);
      return result;
    }
    for (const [sortOrder, sample] of samples.entries()) {
      const map = await ensure('api::map.map', { slug: sample.slug }, {
        name: sample.name, slug: sample.slug, isActive: true, sortOrder,
      });
      const zones = [];
      for (const [index, name] of sample.zones.entries()) {
        const slug = name.toLowerCase().replaceAll(' ', '-');
        zones.push(await ensure('api::map-zone.map-zone', { slug, map: { documentId: map.documentId } }, {
          name, slug, map: map.documentId, sortOrder: index,
        }));
      }
      const grenades = [];
      for (const { from, target, ...grenade } of sample.grenades) {
        grenades.push(await ensure('api::grenade.grenade', { slug: grenade.slug, map: { documentId: map.documentId } }, {
          ...grenade, map: map.documentId, fromZone: zones[from].documentId, targetZone: zones[target].documentId,
        }));
      }
      const isMirage = sample.slug === 'mirage';
      const slug = isMirage ? 'demo-a-execute' : 'demo-b-retake';
      await ensure('api::script.script', { slug, map: { documentId: map.documentId } }, {
        title: isMirage ? 'Демо: выход на A — Mirage' : 'Демо: ретейк B — Inferno',
        slug,
        description: isMirage
          ? 'Демонстрационный сценарий тренировки: подготовьте дым на A, согласуйте выход с командой и потренируйте проверку позиций. Это пример контента, а не проверенная инструкция по раскидке.'
          : 'Демонстрационный сценарий тренировки: соберитесь для ретейка B, используйте молотов для контроля банана и потренируйте совместную проверку позиций. Это пример контента, а не проверенная инструкция по раскидке.',
        map: map.documentId,
        side: isMirage ? 't' : 'ct',
        category: 'utility-combo',
        difficulty: 'easy',
        zone: zones[isMirage ? 1 : 2].documentId,
        relatedGrenades: [grenades[isMirage ? 0 : 1].documentId],
      });
    }
    console.log('Demo drafts ready. Add map covers, grenade images, and script videos/thumbnails in Content Manager before publishing.');
  } finally { await app.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
