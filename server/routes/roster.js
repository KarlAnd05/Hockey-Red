/**
 * Public roster endpoint. One program at a time, because the men's and women's
 * pages each render their own.
 */
import { Router } from 'express';
import { rosterForProgram } from '../lib/roster.js';

export const rosterRouter = Router();

rosterRouter.get('/roster', (req, res) => {
  const program = req.query.program === 'mens' ? 'mens' : 'womens';
  res.json(rosterForProgram(program));
});
