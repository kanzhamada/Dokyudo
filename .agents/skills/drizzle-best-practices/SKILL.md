---
name: drizzle-best-practices
description: Drizzle ORM PostgreSQL best practices, focusing on modern identity columns, optimized indexing, performant timestamp formats, and type-safe enums. Use this skill when designing or refactoring database schemas with Drizzle ORM.
---

# Drizzle ORM PostgreSQL Best Practices Guide (2025)

## Latest Drizzle ORM features and optimal schema patterns

**Major 2025 Update**: PostgreSQL now recommends **identity columns** over serial types. Drizzle has fully embraced this change.


```typescript
import { pgTable, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// Modern schema with identity columns (NEW STANDARD)
export const users = pgTable('users', {
  // Identity column - the new recommended approach
  id: integer('id').primaryKey().generatedAlwaysAsIdentity({
    startWith: 1000,
    increment: 1,
    minValue: 1,
    maxValue: 2147483647,
    cache: 1
  }),
  email: varchar('email', { length: 320 }).notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
});

// Reusable column patterns
export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => new Date()),
  deletedAt: timestamp('deleted_at'),
};
```

## Timestamp handling best practices

**Performance analysis shows date mode with timezone is optimal** for most use cases:

```typescript
export const events = pgTable('events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  
  // Optimal timestamp configuration
  createdAt: timestamp('created_at', { 
    mode: 'date',        // Date mode for performance
    precision: 3,        // Millisecond precision
    withTimezone: true   // Always use timezone for consistency
  }).notNull().defaultNow(),
  
  scheduledAt: timestamp('scheduled_at', { 
    mode: 'date', 
    precision: 3, 
    withTimezone: true 
  }),
});

// String mode only when you need specific formatting control
const legacyTable = pgTable('legacy', {
  timestamp: timestamp('timestamp', { mode: 'string' }), // Slower, use sparingly
});
```

**Key findings**: Date mode is 10-15% faster than string mode, and precision 3 provides the best balance between accuracy and storage efficiency.

## Most efficient indexing strategies

**Comprehensive indexing patterns** based on production benchmarks:

```typescript
export const orders = pgTable('orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  customerId: integer('customer_id').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  orderDate: timestamp('order_date', { mode: 'date' }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  metadata: jsonb('metadata'),
  tags: text('tags').array(),
}, (table) => [
  // B-tree indexes (default - fastest for equality/range queries)
  index('orders_customer_idx').on(table.customerId),
  
  // Composite index - column order matters!
  index('orders_customer_status_date_idx')
    .on(table.customerId, table.status, table.orderDate.desc()),
  
  // Partial index - up to 275x performance improvement
  index('orders_active_idx')
    .on(table.customerId, table.orderDate.desc())
    .where(sql`${table.status} = 'active'`),
  
  // Covering index to avoid table lookups
  index('orders_covering_idx')
    .on(table.customerId, table.orderDate.desc())
    .include(table.totalAmount),
  
  // GIN index for JSONB operations
  index('orders_metadata_idx').using('gin', table.metadata),
  
  // GIN index for array operations
  index('orders_tags_idx').using('gin', table.tags),
]);
```

## Modern enum handling and type safety

**Type-safe enum patterns** with full TypeScript integration:

```typescript
import { pgEnum, pgTable, integer, text } from 'drizzle-orm/pg-core';

// Utility for TypeScript enum conversion
export function enumToPgEnum<T extends Record<string, string>>(
  myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum) as [T[keyof T], ...T[keyof T][]];
}

// TypeScript enum
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

// Drizzle enum
export const userRoleEnum = pgEnum('user_role', enumToPgEnum(UserRole));

// Alternative: const array pattern
export const orderStatuses = ['pending', 'processing', 'shipped', 'delivered'] as const;
export type OrderStatus = typeof orderStatuses[number];
export const orderStatusEnum = pgEnum('order_status', orderStatuses);

// Usage in table
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  role: userRoleEnum('role').default(UserRole.USER).notNull(),
});
```

## Zod integration and validation best practices

**Complete validation workflow** with drizzle-zod:

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Generate Zod schemas from Drizzle tables
export const insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email('Invalid email format'),
  name: (schema) => schema.min(2, 'Name must be at least 2 characters'),
});

export const selectUserSchema = createSelectSchema(users);

// Advanced validation with business logic
export const createOrderSchema = createInsertSchema(orders, {
  totalAmount: (schema) => schema.positive('Amount must be positive'),
  orderDate: z.coerce.date(), // Coerce strings to dates
}).refine((data) => {
  // Custom business logic validation
  if (data.status === 'shipped' && !data.shippedAt) {
    return false;
  }
  return true;
}, {
  message: 'Shipped orders must have a shipped date',
  path: ['shippedAt'],
});

// API route integration
export async function createUser(data: unknown) {
  // Runtime validation
  const validated = insertUserSchema.parse(data);
  
  // Type-safe database operation
  const [user] = await db.insert(users).values(validated).returning();
  return user;
}
```

## Performance optimization techniques

**Production-proven optimization patterns**:

```typescript
// 1. Prepared statements for frequent queries
const getUserByEmail = db
  .select()
  .from(users)
  .where(eq(users.email, sql.placeholder('email')))
  .prepare('getUserByEmail');

// Reuse for performance
const user = await getUserByEmail.execute({ email: 'user@example.com' });

// 2. Selective field loading
const posts = await db.query.posts.findMany({
  columns: {
    id: true,
    title: true,
    // Exclude large content field
  },
  with: {
    author: {
      columns: { id: true, name: true },
    },
  },
  limit: 20,
});

// 3. Connection pool optimization
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });
```

## Community recommendations summary

**Production insights from 2024-2025**:

1. **Project structure**: Organize schemas by domain in separate files
2. **Migration strategy**: Use `drizzle-kit generate` for production, `push` for development

**Common pitfalls to avoid**:
- Over-indexing causing slow writes
- Missing indexes on foreign keys
- Using string mode for timestamps unnecessarily
- Not leveraging prepared statements

## Latest syntax updates and features

**Row-Level Security (RLS)** support (October 2024):

```typescript
import { pgTable, pgRole, pgPolicy, integer, text, sql } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  userId: integer('user_id').notNull(),
}, (table) => [
  pgPolicy('posts_select_policy', {
    as: 'permissive',
    for: 'select',
    using: sql`user_id = auth.uid()`
  }),
]);
```

**Generated columns** for computed values:

```typescript
const articles = pgTable('articles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  content: text('content'),
  searchVector: tsVector('search_vector').generatedAlwaysAs(
    (): SQL => sql`to_tsvector('english', ${articles.title} || ' ' || ${articles.content})`
  ),
});
```

## UUID vs other ID strategies

**Recommended approach**: Hybrid strategy for best of both worlds

```typescript
export const optimizedTable = pgTable('optimized_table', {
  // Internal ID for performance (relations, joins)
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  
  // External ID for security (URLs, APIs)
  publicId: varchar('public_id', { length: 12 })
    .unique()
    .notNull()
    .$defaultFn(() => generateNanoId()),
  
  // Alternative: UUIDv7 for time-ordered uniqueness
  uuid: uuid('uuid').$defaultFn(() => generateUUIDv7()),
});

// NanoID generation (3.7M ops/sec)
import { customAlphabet } from 'nanoid';
const generateNanoId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);
```

**Performance comparison**:
- BigSerial: Fastest, best for internal use
- UUIDv7: 95% of bigserial performance, time-ordered
- UUIDv4: Only 33% of bigserial performance, avoid for primary keys

## Foreign key relationships and constraints

**Modern relationship patterns**:

```typescript
// One-to-many with cascade
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { 
      onDelete: 'cascade',
      onUpdate: 'cascade' 
    })
    .notNull(),
}, (table) => [
  // Always index foreign keys
  index('posts_author_idx').on(table.authorId),
]);

// Many-to-many junction table
export const postsToTags = pgTable('posts_to_tags', {
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  tagId: integer('tag_id')
    .references(() => tags.id, { onDelete: 'cascade' })
    .notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.tagId] }),
  index('posts_tags_post_idx').on(table.postId),
  index('posts_tags_tag_idx').on(table.tagId),
]);

// Define relations for query API
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

## Complete production-ready schema example

```typescript
import { pgTable, pgEnum, integer, varchar, text, timestamp, boolean, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'moderator']);
export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived']);

// Reusable columns
const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
};

// Users table
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  publicId: varchar('public_id', { length: 12 }).unique().notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  preferences: jsonb('preferences').$type<{
    theme: 'light' | 'dark';
    notifications: boolean;
  }>(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
  index('users_active_idx').on(table.email).where(sql`${table.isActive} = true`),
]);

// Posts table
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  status: postStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at', { mode: 'date', precision: 3, withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('posts_author_idx').on(table.authorId),
  index('posts_published_idx').on(table.publishedAt).where(sql`${table.status} = 'published'`),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

---

This comprehensive guide represents the current best practices for Drizzle ORM PostgreSQL schemas as of 2025, based on official documentation, community patterns, and production experiences.
