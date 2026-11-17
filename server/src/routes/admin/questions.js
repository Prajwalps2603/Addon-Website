import { Router } from 'express';
import * as z from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { toAdminQuestion } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['pending', 'published', 'rejected'];

const listSchema = pagination.extend({
  status: z.enum([...STATUSES, '']).optional(),
  kind: z.enum(['general', 'fitment', '']).optional(),
  q: z.string().trim().max(100).optional(),
});

const answerSchema = z.object({
  answer: z.string().trim().max(1000).optional(),
  fitType: z.enum(['direct', 'with_work', 'no']).optional(),
  isVerified: z.boolean().optional(),
  status: z.enum(STATUSES).optional(),
});

// How many shoppers asked the same thing: for a fitment question, every question in the same state
// about the same product and car (this one included). A general question counts once.
const SELECT = `SELECT q.*, p.name AS product_name, p.slug AS product_slug,
    CASE WHEN q.kind = 'fitment' AND q.vehicle_id IS NOT NULL THEN (
      SELECT COUNT(*) FROM product_questions s
      WHERE s.product_id = q.product_id AND s.vehicle_id = q.vehicle_id AND s.kind = 'fitment' AND s.status = q.status
    ) ELSE 1 END AS same_ask_count
  FROM product_questions q JOIN products p ON p.id = q.product_id`;

const likePattern = (text) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function loadQuestion(ctx, id) {
  const row = ctx.db.get(`${SELECT} WHERE q.id = ?`, [id]);
  if (!row) throw notFound('Question');
  return row;
}

/** The reply a shopper reads when the owner taps a verdict and writes nothing. */
function defaultAnswer(fitType, vehicleLabel) {
  const car = vehicleLabel || 'your car';
  if (fitType === 'direct') return `Yes, this fits the ${car} as it comes.`;
  if (fitType === 'no') return `No, this does not fit the ${car}.`;
  return '';
}

export default function adminQuestionsRoutes(ctx) {
  const router = Router();

  router.get('/questions', (req, res) => {
    const query = parse(listSchema, req.query);
    const where = [];
    const params = {};
    if (query.status) {
      where.push('q.status = :status');
      params.status = query.status;
    }
    if (query.kind) {
      where.push('q.kind = :kind');
      params.kind = query.kind;
    }
    if (query.q) {
      where.push("(q.question LIKE :q ESCAPE '\\' OR q.author_name LIKE :q ESCAPE '\\' OR q.vehicle_label LIKE :q ESCAPE '\\' OR p.name LIKE :q ESCAPE '\\')");
      params.q = likePattern(query.q);
    }
    const filter = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM product_questions q JOIN products p ON p.id = q.product_id${filter}`, params);
    const rows = ctx.db.all(
      `${SELECT}${filter}
       ORDER BY CASE q.status WHEN 'pending' THEN 0 ELSE 1 END, CASE q.kind WHEN 'fitment' THEN 0 ELSE 1 END,
         same_ask_count DESC, q.created_at ASC, q.id ASC
       LIMIT :limit OFFSET :offset`,
      { ...params, limit: query.limit, offset: (query.page - 1) * query.limit },
    );
    res.json(paginated(rows.map(toAdminQuestion), total, query));
  });

  router.put('/questions/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(answerSchema, req.body);
    ctx.db.tx(() => {
      const question = loadQuestion(ctx, id);
      const now = ctx.now();

      // Rejecting, or putting back in the queue, without answering.
      if (body.status === 'rejected' || (body.status === 'pending' && body.answer === undefined && body.fitType === undefined)) {
        ctx.db.run('UPDATE product_questions SET status = ? WHERE id = ?', [body.status, id]);
        return;
      }

      if (question.kind === 'fitment' && body.fitType === undefined && body.answer !== undefined) {
        throw badRequest('Choose whether it fits.', { fitType: 'Choose Fits, Fits with work or Does not fit.' });
      }

      if (question.kind === 'fitment' && body.fitType !== undefined) {
        const answer = body.answer || defaultAnswer(body.fitType, question.vehicle_label);
        if (answer === '') throw badRequest('Say what work it needs.', { answer: 'Say what work is needed to fit it.' });

        if (question.vehicle_id !== null) {
          // Answer once: the store gives this verdict for this car from now on.
          ctx.db.run(
            `INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note, is_verified) VALUES (:productId, :vehicleId, :fitType, :note, :isVerified)
             ON CONFLICT (product_id, vehicle_id) DO UPDATE SET fit_type = excluded.fit_type, note = excluded.note, is_verified = excluded.is_verified`,
            { productId: question.product_id, vehicleId: question.vehicle_id, fitType: body.fitType, note: answer, isVerified: body.isVerified ?? false },
          );
          // Everyone else waiting on the same part and car gets the same answer.
          ctx.db.run(
            `UPDATE product_questions SET answer = :answer, answer_fit_type = :fitType, answered_at = :now, status = 'published'
             WHERE id = :id OR (product_id = :productId AND vehicle_id = :vehicleId AND kind = 'fitment' AND status = 'pending')`,
            { answer, fitType: body.fitType, now, id, productId: question.product_id, vehicleId: question.vehicle_id },
          );
        } else {
          ctx.db.run("UPDATE product_questions SET answer = ?, answer_fit_type = ?, answered_at = ?, status = 'published' WHERE id = ?", [
            answer,
            body.fitType,
            now,
            id,
          ]);
        }
        return;
      }

      // A general question (or publishing one that already has an answer).
      const answer = body.answer ?? question.answer ?? '';
      if (answer === '') throw badRequest('Write the answer first.', { answer: 'Write the answer.' });
      const changed = body.answer !== undefined && body.answer !== question.answer;
      ctx.db.run('UPDATE product_questions SET answer = ?, answered_at = ?, status = ? WHERE id = ?', [
        answer,
        changed || !question.answered_at ? now : question.answered_at,
        body.status === 'pending' ? 'pending' : 'published',
        id,
      ]);
    });
    res.json(toAdminQuestion(loadQuestion(ctx, id)));
  });

  router.delete('/questions/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    if (ctx.db.run('DELETE FROM product_questions WHERE id = ?', [id]).changes === 0) throw notFound('Question');
    res.json({ ok: true });
  });

  return router;
}
