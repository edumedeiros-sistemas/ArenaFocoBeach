import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));

describe('API health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
