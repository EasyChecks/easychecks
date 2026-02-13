/**
 * Express Types Helper
 * Compatible with Express 5.x
 */

import express from 'express';

// Extract types from express instance
export type Request = express.Request;
export type Response = express.Response;

// NextFunction for Express 5.x
export type NextFunction = (err?: any) => void;

// RequestHandler type
export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// ErrorRequestHandler type
export type ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;
