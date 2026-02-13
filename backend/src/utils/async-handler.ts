/**
 * Async Handler Wrapper
 * ลด try-catch ซ้ำซ้อนใน Controllers
 */

import type { Request, Response, NextFunction } from '../types/express.js';

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
