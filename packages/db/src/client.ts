import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from './generated/prisma/client'

export type Db = PrismaClient
export type D1 = ConstructorParameters<typeof PrismaD1>[0]

type ReadOperation =
  | 'findMany'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'count'
  | 'aggregate'
  | 'groupBy'

type ModelName = {
  [K in keyof PrismaClient]: PrismaClient[K] extends { findMany: unknown } ? K : never
}[keyof PrismaClient]

/** A Prisma client with every writing operation removed from its type. */
export type ReadDb = { [K in ModelName]: Pick<PrismaClient[K], ReadOperation> }

/** Cheap to construct: make one per request from `env.DB`. */
export function createClient(d1: D1): Db {
  return new PrismaClient({ adapter: new PrismaD1(d1) })
}
