import { NextResponse } from "next/server";
import { applicationPage, db, ensureDatabase, json, type ApplicationQuestion } from "../../../../lib/db";
import { getSession } from "../../../../lib/session";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in with Discord to review applications." }, { status: 401 });
  const { slug } = await params;
  await ensureDatabase();
  const page = await db().prepare(`SELECT p.id, p.questions FROM application_pages p JOIN servers s ON s.guild_id = p.guild_id
    WHERE p.slug = ? AND s.owner_id = ?`).bind(slug, user.id).first();
  if (!page) return NextResponse.json({ error: "Application page not found." }, { status: 404 });
  const submissions = await db().prepare(`SELECT a.id, a.applicant_id, a.answers, a.status, a.response, a.created_at, a.updated_at,
    p.username, p.display_name, p.avatar_url
    FROM application_submissions a LEFT JOIN profiles p ON p.discord_id = a.applicant_id
    WHERE a.page_id = ? ORDER BY a.created_at DESC`).bind(page.id).all();
  return NextResponse.json({
    questions: json<ApplicationQuestion[]>(page.questions as string, []),
    submissions: (submissions.results || []).map((submission: Record<string, unknown>) => ({
      id: Number(submission.id), applicantId: submission.applicant_id, username: submission.username || submission.applicant_id,
      displayName: submission.display_name || submission.username || "Discord user", avatarUrl: submission.avatar_url || "",
      answers: json<Record<string, string>>(submission.answers as string, {}), status: submission.status,
      response: submission.response || "", createdAt: submission.created_at, updatedAt: submission.updated_at,
    })),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getSession();
  const { slug } = await params;
  if (!user) return NextResponse.json({ error: "Sign in with Discord before applying." }, { status: 401 });
  const page = await applicationPage(slug);
  if (!page || page.status !== "open") return NextResponse.json({ error: "This application page is not accepting responses." }, { status: 404 });
  const input = await request.json() as { answers?: Record<string, unknown> };
  const answers: Record<string, string> = {};
  for (const question of page.questions) {
    const answer = String(input.answers?.[question.id] || "").trim().slice(0, question.type === "long" ? 2000 : 400);
    if (question.required && !answer) return NextResponse.json({ error: `Answer “${question.label}” before submitting.` }, { status: 400 });
    if (answer) answers[question.id] = answer;
  }
  try {
    await db().prepare("INSERT INTO application_submissions (page_id, applicant_id, answers) VALUES (?, ?, ?)").bind(page.id, user.id, JSON.stringify(answers)).run();
  } catch {
    return NextResponse.json({ error: "You have already submitted an application to this server." }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in with Discord to respond." }, { status: 401 });
  const { slug } = await params;
  const input = await request.json() as Record<string, unknown>;
  const submissionId = Number(input.submissionId);
  const status = String(input.status || "");
  const response = String(input.response || "").trim().slice(0, 1500);
  if (!Number.isInteger(submissionId) || !["submitted", "accepted", "declined", "more_info"].includes(status)) return NextResponse.json({ error: "Choose a valid application status." }, { status: 400 });
  await ensureDatabase();
  const page = await db().prepare(`SELECT p.id FROM application_pages p JOIN servers s ON s.guild_id = p.guild_id
    WHERE p.slug = ? AND s.owner_id = ?`).bind(slug, user.id).first();
  if (!page) return NextResponse.json({ error: "Application page not found." }, { status: 404 });
  const updated = await db().prepare("UPDATE application_submissions SET status = ?, response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND page_id = ?").bind(status, response, submissionId, page.id).run();
  if (!updated.meta?.changes) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
