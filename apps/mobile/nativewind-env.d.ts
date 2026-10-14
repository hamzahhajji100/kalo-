/// <reference types="nativewind/types" />

declare module '*.css';

declare module '*.sql' {
  const sql: string;
  export default sql;
}
