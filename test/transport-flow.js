const assert = require('node:assert/strict');

const requiredTransport = { disassembly: 'no', stairs: 'no', vehicle: 'car' };

async function exerciseTransportRequirements(request) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const json = { 'Content-Type': 'application/json' };
  const register = async role => {
    const result = await request('/api/auth/register', { method: 'POST', headers: json,
      body: JSON.stringify({ name: `Transporte ${role}`, email: `transport-${role}-${suffix}@example.test`, password: 'senha-segura-123', city: 'Belém, PA' }) });
    assert.equal(result.response.status, 201);
    return { ...json, Authorization: `Bearer ${result.payload.token}` };
  };
  const owner = await register('owner'), stranger = await register('stranger');
  const fields = { title: `Retirada de mesa ${suffix}`, description: 'Mesa para estudo em bom estado de conservação.', category: 'Móveis', goal: 'Doação', location: 'Belém, PA', imageUrl: 'https://images.example.test/mesa-transporte.jpg' };
  const create = body => request('/api/posts', { method: 'POST', headers: owner, body: JSON.stringify(body) });
  const getPost = async id => (await request(`/api/posts/${id}`, { headers: owner })).payload.post;
  const update = (id, body, headers = owner) => request(`/api/posts/${id}/transport`, { method: 'PUT', headers, body: JSON.stringify(body) });

  assert.equal((await create(fields)).response.status, 400, 'transport answers are required for new posts');
  for (const key of Object.keys(requiredTransport)) {
    const missing = { ...fields, ...requiredTransport }; delete missing[key];
    for (const body of [missing, { ...fields, ...requiredTransport, [key]: '' }, { ...fields, ...requiredTransport, [key]: 'unknown' }, { ...fields, ...requiredTransport, [key]: null }, { ...fields, ...requiredTransport, [key]: [] }]) {
      const result = await create(body);
      assert.equal(result.response.status, 400, `missing or invalid ${key}: ${JSON.stringify(result.payload)}`);
      assert.match(result.payload.error, /desmont|escada|transporte/i);
    }
  }
  const beforeValid = (await request('/api/feed', { headers: owner })).payload.posts;
  assert.ok(!beforeValid.some(post => post.title === fields.title), 'invalid creation must not leave posts behind');

  const created = await create({ ...fields, ...requiredTransport });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const post = created.payload.post;
  assert.equal(post.transport.disassembly, 'no'); assert.equal(post.transport.stairs, 'no'); assert.equal(post.transport.vehicle, 'car');
  assert.equal(post.transport.dimensions, ''); assert.equal(post.transport.weightKg, null); assert.equal(post.transport.transportNotes, '');
  assert.equal(post.hasApproximateLocation, false, 'geolocation remains optional');

  const form = new FormData();
  Object.entries({ ...fields, ...requiredTransport, title: `${fields.title} multipart` }).forEach(([key, value]) => form.set(key, value));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZYQAAAAASUVORK5CYII=', 'base64');
  form.set('images', new Blob([png], { type: 'image/png' }), 'mesa.png');
  const multipart = await request('/api/posts', { method: 'POST', headers: { Authorization: owner.Authorization }, body: form });
  assert.equal(multipart.response.status, 201, JSON.stringify(multipart.payload));
  assert.equal(multipart.payload.post.transport.vehicle, 'car');

  assert.equal((await update(post.id, {}, stranger)).response.status, 403, 'ownership is checked before transport validation');
  const complete = { dimensions: '100 × 60 × 75 cm', weightKg: 12, transportNotes: 'Trazer ajuda para carregar.', areaLat: -1.451234, areaLng: -48.491234 };
  assert.equal((await update(post.id, complete)).response.status, 200);
  assert.equal((await update(post.id, { dimensions: '110 × 60 × 75 cm' })).response.status, 200);
  const updated = await getPost(post.id);
  assert.equal(updated.transport.dimensions, '110 × 60 × 75 cm');
  assert.equal(updated.transport.weightKg, 12); assert.equal(updated.transport.transportNotes, complete.transportNotes);
  assert.equal(updated.transport.disassembly, 'no'); assert.equal(updated.transport.stairs, 'no'); assert.equal(updated.transport.vehicle, 'car');
  assert.equal(updated.hasApproximateLocation, true, 'partial updates preserve the approximate region');

  for (const body of [{ stairs: 'unknown' }, { disassembly: '' }, { vehicle: 'unknown' }, { weightKg: -1 }]) {
    assert.equal((await update(post.id, body)).response.status, 400);
    const unchanged = await getPost(post.id);
    assert.deepEqual(unchanged.transport, updated.transport, 'invalid edits must not mutate transport information');
    assert.equal(unchanged.hasApproximateLocation, true);
  }
  assert.equal((await update(post.id, { areaLat: '', areaLng: '' })).response.status, 200);
  const removedRegion = await getPost(post.id);
  assert.equal(removedRegion.hasApproximateLocation, false);
  assert.deepEqual(removedRegion.transport, updated.transport);
}

module.exports = { requiredTransport, exerciseTransportRequirements };
