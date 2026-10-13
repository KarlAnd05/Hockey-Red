/**
 * News - the public list, and the per-post pages that make sharing work.
 */
import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from '../db.js';
import { listPosts, findPostBySlug, serialisePost, renderPostPage } from '../lib/news.js';
import { applyContent } from '../lib/content.js';

export const newsRouter = Router();

/* The list the newsroom page renders from. */
newsRouter.get('/news', (req, res) => {
  res.json({ posts: listPosts().map(serialisePost) });
});

/* --------------------------------------------------------------------------
   One post, server-rendered
   --------------------------------------------------------------------------
   Mounted at the site root rather than under /api, because this is a page a
   person (or a link-preview crawler) visits. Crawlers do not run JavaScript, so
   the title, description and image have to be in the HTML that leaves the
   server - that is the entire reason this route exists instead of an anchor.
   -------------------------------------------------------------------------- */
export const newsPageRouter = Router();

newsPageRouter.get('/news/:slug', (req, res, next) => {
  /* The slug is looked up in the database and never touched to the filesystem,
     so there is nothing here to traverse with. */
  const post = findPostBySlug(req.params.slug);
  if (!post || !post.active) return next();

  const shellPath = join(rootDir, 'news.html');
  if (!existsSync(shellPath)) return next();

  try {
    const shell = readFileSync(shellPath, 'utf8');
    /* Run the editable-copy overrides over the shell first, so the header and
       footer on a post page say whatever the admin set them to say. */
    const html = renderPostPage(post, applyContent('news.html', shell));

    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  } catch (error) {
    console.error('[news] could not render %s:', req.params.slug, error.message);
    next();
  }
});
