import { NextResponse } from "next/server";
import { db, ensureDatabase, json, type ApplicationQuestion } from "../../../lib/db";
import { getSession } from "../../../lib/session";

const questionTypes = new Set(["short", "long", "yes_no"]);

function readQuestions(value: unknown): ApplicationQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const questions = value.map((question) => {
    const item = question as Record<string, unknown>;
    return {
      id: String(item.id || "").trim().slice(0, 50),
      label: String(item.label || "").trim().slice(0, 160),
      type: String(item.type || "short") as ApplicationQuestion["type"],
      required: Boolean(item.required),
    };
  });
  return questions.every((question) => /^[a-zA-Z0-9-]+$/.test(question.id) && question.label.length >= 3 && questionTypes.has(question.type)) ? questions : null;
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in with Discord to manage applications." }, { status: 401 });
  await ensureDatabase();
  const servers = await db().prepare("SELECT guild_id, name, icon_url, verified FROM servers WHERE owner_id = ? ORDER BY name").bind(user.id).all();
  const pages = await db().prepare(`SELECT p.id, p.guild_id, p.slug, p.title, p.description, p.accent_color, p.questions, p.status,
    s.name server_name, COUNT(a.id) submission_count
    FROM application_pages p JOIN servers s ON s.guild_id = p.guild_id
    LEFT JOIN application_submissions a ON a.page_id = p.id
    WHERE s.owner_id = ? GROUP BY p.id ORDER BY p.updated_at DESC`).bind(user.id).all();
  return NextResponse.json({
    servers: (servers.results || []).map((server: Record<string, unknown>) => ({ guildId: server.guild_id, name: server.name, iconUrl: server.icon_url, verified: Boolean(server.verified) })),
    pages: (pages.results || []).map((page: Record<string, unknown>) => ({
      id: Number(page.id), guildId: page.guild_id, slug: page.slug, title: page.title, description: page.description,
      accentColor: page.accent_color, questions: json(page.questions as string, []), status: page.status,
      serverName: page.server_name, submissionCount: Number(page.submission_count || 0),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in with Discord to create an application page." }, { status: 401 });
  const input = await request.json() as Record<string, unknown>;
  const guildId = String(input.guildId || "").trim();
  const slug = String(input.slug || "").trim().toLowerCase();
  const title = String(input.title || "").trim().slice(0, 100);
  const description = String(input.description || "").trim().slice(0, 1000);
  const accentColor = String(input.accentColor || "#1466ff");
  const status = input.status === "closed" ? "closed" : "open";
  const questions = readQuestions(input.questions);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 50) return NextResponse.json({ error: "Choose a URL using 3–50 lowercase letters, numbers or single hyphens." }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ error: "Add a clear application page title." }, { status: 400 });
  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) return NextResponse.json({ error: "Choose a valid accent color." }, { status: 400 });
  if (!questions) return NextResponse.json({ error: "Add between 1 and 20 valid questions." }, { status: 400 });
  await ensureDatabase();
  const server = await db().prepare("SELECT guild_id FROM servers WHERE guild_id = ? AND owner_id = ?").bind(guildId, user.id).first();
  if (!server) return NextResponse.json({ error: "Only the registered server owner can manage this application page." }, { status: 403 });
  const slugOwner = await db().prepare("SELECT guild_id FROM application_pages WHERE slug = ? AND guild_id != ?").bind(slug, guildId).first();
  if (slugOwner) return NextResponse.json({ error: "That application link is already in use." }, { status: 409 });
  await db().prepare(`INSERT INTO application_pages (guild_id, slug, title, description, accent_color, questions, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET slug=excluded.slug, title=excluded.title, description=excluded.description,
    accent_color=excluded.accent_color, questions=excluded.questions, status=excluded.status, updated_at=CURRENT_TIMESTAMP`)
    .bind(guildId, slug, title, description, accentColor, JSON.stringify(questions), status, user.id).run();
  return NextResponse.json({ ok: true, url: `/a/${slug}` });
}
