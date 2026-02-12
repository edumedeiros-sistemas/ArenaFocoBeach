import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import './config/firebase.js';
import courtsRouter from './routes/courts.js';
import classesRouter from './routes/classes.js';
import championshipsRouter from './routes/championships.js';
import leaguesRouter from './routes/leagues.js';
import paymentsRouter from './routes/payments.js';
import usersRouter from './routes/users.js';
import bookingsRouter from './routes/bookings.js';
import settingsRouter from './routes/settings.js';
import agendaRouter from './routes/agenda.js';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, service: 'beach-flow-api' }));

// Esta porta é só a API. O frontend (React) roda em outra porta.
app.get('/', (_, res) => {
  res.json({
    message: 'Beach Flow API',
    frontend: 'Abra o app em http://localhost:5173',
    health: '/health',
  });
});

app.use('/quadras', courtsRouter);
app.use('/aulas', classesRouter);
app.use('/campeonatos', championshipsRouter);
app.use('/ligas', leaguesRouter);
app.use('/pagamentos', paymentsRouter);
app.use('/users', usersRouter);
app.use('/reservas', bookingsRouter);
app.use('/settings', settingsRouter);
app.use('/agenda', agendaRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Beach Flow API rodando em http://localhost:${PORT}`);
});
