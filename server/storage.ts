import { users, faqs, type User, type InsertUser, type Faq, type InsertFaq } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  searchFaqs(query: string, limit: number): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  getAllFaqs(): Promise<Faq[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async searchFaqs(query: string, limit: number): Promise<Faq[]> {
    const searchPattern = `%${query}%`;
    
    const results = await db
      .select()
      .from(faqs)
      .where(
        or(
          ilike(faqs.question, searchPattern),
          ilike(faqs.answer, searchPattern)
        )
      )
      .limit(limit);
    
    return results;
  }

  async createFaq(insertFaq: InsertFaq): Promise<Faq> {
    const [faq] = await db
      .insert(faqs)
      .values(insertFaq)
      .returning();
    return faq;
  }

  async getAllFaqs(): Promise<Faq[]> {
    return await db.select().from(faqs);
  }
}

export const storage = new DatabaseStorage();
