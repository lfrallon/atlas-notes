import {
  foreignKey,
  pgTable,
  doublePrecision,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export const todos = pgTable(
  'todos',
  {
    id: serial().primaryKey().notNull(),
    title: text().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
    userId: text('user_id').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'todos_user_id_user_id_fk',
    }).onDelete('cascade'),
  ],
)
