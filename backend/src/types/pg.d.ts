declare module 'pg' {
  export interface PoolConfig {
    connectionString?: string;
    [key: string]: any;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    end(): Promise<void>;
    [key: string]: any;
  }

  export interface QueryResult {
    rows: any[];
    [key: string]: any;
  }

  export class Client {
    constructor(config?: any);
    [key: string]: any;
  }
}
