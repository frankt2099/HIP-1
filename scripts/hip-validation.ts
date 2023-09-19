import { z } from 'zod';
import matter from 'gray-matter';

const hipType = z.object({
  discussions: z.string(),
  title: z.string(),
  author: z.string(),
});

/**
 * Validates the hip header and returns the hip title
 * @param content
 * @returns string hip title
 */
export function validateHIPHeader(content: string) {
  const fm = matter(content);
  hipType.parse(fm.data);
  return fm.data.title;
}
