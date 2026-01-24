import { relations } from 'drizzle-orm/relations'
import { todos } from './todos'
import { account, session, user } from './auth-schema'

export const todosRelations = relations(todos, ({ one }) => ({
  user: one(user, {
    fields: [todos.userId],
    references: [user.id],
  }),
}))

export const userRelations = relations(user, ({ many }) => ({
  todos: many(todos),
  accounts: many(account),
  sessions: many(session),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))
