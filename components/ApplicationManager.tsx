"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { ApplicationQuestion } from "../lib/db";

type Server = { guildId: string; name: string; iconUrl: string; verified: boolean };
type ApplicationPage = { guildId: string; slug: string; title: string; description: string; accentColor: string; questions: ApplicationQuestion[]; status: string; serverName: string; submissionCount: number };
type Submission = { id: number; applicantId: string; displayName: string; username: string; avatarUrl: string; answers: Record<string, string>; status: string; response: string; createdAt: string };

const emptyQuestion = (): ApplicationQuestion => ({ id: crypto.randomUUID(), label: "", type: "long", required: true });

export default function ApplicationManager() {
  const [servers, setServers] = useState<Server[]>([]);
  const [pages, setPages] = useState<ApplicationPage[]>([]);
  const [guildId, setGuildId] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("Staff Application");
  const [description, setDescription] = useState("");
  const [accentColor, setAccentColor] = useState("#1466ff");
  const [status, setStatus] = useState("open");
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([emptyQuestion()]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadSubmissions(pageSlug: string) {
    const response = await fetch(`/api/application-pages/${encodeURIComponent(pageSlug)}`);
    if (response.ok) setSubmissions((await response.json()).submissions || []);
  }

  function selectPage(page: ApplicationPage) {
    setGuildId(page.guildId); setSlug(page.slug); setTitle(page.title); setDescription(page.description);
    setAccentColor(page.accentColor); setStatus(page.status); setQuestions(page.questions); setSaved(false);
    loadSubmissions(page.slug);
  }

  useEffect(() => {
    fetch("/api/application-pages").then(async (response) => {
      if (response.status === 401) { location.href = "/login?returnTo=/applications/manage"; return null; }
      return response.json();
    }).then((data) => {
      if (!data) return;
      setServers(data.servers || []);
      setPages(data.pages || []);
      if (data.pages?.[0]) {
        const page = data.pages[0] as ApplicationPage;
        setGuildId(page.guildId); setSlug(page.slug); setTitle(page.title); setDescription(page.description);
        setAccentColor(page.accentColor); setStatus(page.status); setQuestions(page.questions);
        fetch(`/api/application-pages/${encodeURIComponent(page.slug)}`).then((response) => response.json()).then((result) => setSubmissions(result.submissions || [])).catch(() => null);
      } else if (data.servers?.[0]) setGuildId(data.servers[0].guildId);
    }).catch(() => setError("Could not load application management.")).finally(() => setLoading(false));
  }, []);

  function updateQuestion(index: number, changes: Partial<ApplicationQuestion>) {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= questions.length) return;
    setQuestions((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaved(false);
    const response = await fetch("/api/application-pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guildId, slug, title, description, accentColor, status, questions }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not save the application page."); return; }
    setSaved(true);
    const refreshed = await fetch("/api/application-pages").then((res) => res.json());
    setPages(refreshed.pages || []);
    loadSubmissions(slug);
  }

  async function respond(event: FormEvent<HTMLFormElement>, submissionId: number) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch(`/api/application-pages/${encodeURIComponent(slug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId, ...Object.fromEntries(new FormData(form)) }) });
    if (!response.ok) { setError((await response.json()).error || "Could not update the application."); return; }
    loadSubmissions(slug);
  }

  if (loading) return <main className="center-state"><span className="loader" /><p>Loading application management…</p></main>;

  return <><header className="topbar"><Link className="brand" href="/"><img src="/logo.png" alt="" />RYCP</Link><nav><Link href="/opportunities">Opportunities</Link><Link href="/leaderboard">Leaderboard</Link><Link className="account-link" href="/dashboard"><img src="/logo.png" alt="" /><span>My profile</span></Link></nav></header><main className="shell application-manager">
    <div className="page-heading"><div><span className="eyebrow">Server recruitment</span><h1>Create an application link.</h1><p>Build a custom page, share one short RYCP link and review every response from one place.</p></div><div className="dashboard-actions"><a className="button secondary" href="/dashboard">My profile</a>{slug && <a className="button" href={`/a/${slug}`} target="_blank">Open public page</a>}</div></div>
    {!servers.length ? <section className="panel application-onboarding"><h2>Connect a server first</h2><p>Add the RYCP bot and register your server before creating an application page. This confirms who is allowed to view private responses.</p><a className="button" href="https://discord.com/oauth2/authorize?client_id=1539903206967091270&permissions=2147863616&integration_type=0&scope=bot+applications.commands" target="_blank">Add RYCP Bot</a><code>/server_register</code></section> : <>
      {pages.length > 0 && <section className="application-page-switcher"><span>Your pages</span>{pages.map((page) => <button type="button" className={page.guildId === guildId ? "active" : ""} key={page.guildId} onClick={() => selectPage(page)}><strong>{page.serverName}</strong><small>{page.submissionCount} responses · /a/{page.slug}</small></button>)}</section>}
      <div className="application-management-grid">
        <form className="panel application-builder" onSubmit={savePage}>
          <div><h2>Page settings</h2><p>Everything below appears on your public application page.</p></div>
          <label>Server<select value={guildId} onChange={(event) => { const id = event.target.value; setGuildId(id); const page = pages.find((item) => item.guildId === id); if (page) selectPage(page); }} required>{servers.map((server) => <option value={server.guildId} key={server.guildId}>{server.name}</option>)}</select></label>
          <label>Application link<div className="slug-field"><span>rycp.pro/a/</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} minLength={3} maxLength={50} required placeholder="servername" /></div></label>
          <label>Page title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
          <label>Introduction<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Explain the role, expectations and what happens after applying." /></label>
          <div className="form-grid"><label>Accent color<input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label><label>Applications<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="closed">Closed</option></select></label></div>
          <div className="question-builder"><div><h2>Questions</h2><p>Add up to 20 questions and arrange them in the order applicants should see.</p></div>{questions.map((question, index) => <article key={question.id}>
            <div className="question-number">{index + 1}</div><div className="question-fields"><input aria-label={`Question ${index + 1}`} value={question.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} maxLength={160} required placeholder="What experience do you have?" /><div><select value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as ApplicationQuestion["type"] })}><option value="long">Long answer</option><option value="short">Short answer</option><option value="yes_no">Yes or no</option></select><label className="required-question"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} /> Required</label></div></div><div className="question-actions"><button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1}>↓</button><button type="button" onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} disabled={questions.length === 1}>×</button></div>
          </article>)}<button className="button secondary" type="button" disabled={questions.length >= 20} onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>Add question</button></div>
          {error && <p className="form-error">{error}</p>}{saved && <p className="saved">Application page saved. Your link is ready to share.</p>}
          <button className="button" type="submit">Save application page</button>
        </form>
        <section className="application-preview" style={{ "--application-accent": accentColor } as React.CSSProperties}><span>Live page preview</span><div className="panel"><strong>{servers.find((server) => server.guildId === guildId)?.name}</strong><h2>{title || "Staff Application"}</h2><p>{description || "Your introduction will appear here."}</p>{questions.map((question, index) => <div key={question.id}><b>{index + 1}. {question.label || "Untitled question"}</b><i /></div>)}</div></section>
      </div>
      {slug && <section className="application-responses"><div className="section-intro"><span className="eyebrow">Private management view</span><h2>Application responses</h2><p>Review complete answers and send a clear decision or follow-up message.</p></div>{submissions.length ? submissions.map((submission) => <article className="panel submission-card" key={submission.id}><header><img src={submission.avatarUrl || "/logo.png"} alt="" /><div><h3>{submission.displayName}</h3><span>@{submission.username} · {new Date(submission.createdAt).toLocaleDateString()}</span></div><b className={`submission-status status-${submission.status}`}>{submission.status.replace("_", " ")}</b></header><div className="submission-answers">{questions.map((question) => <div key={question.id}><strong>{question.label}</strong><p>{submission.answers[question.id] || "No answer"}</p></div>)}</div><form onSubmit={(event) => respond(event, submission.id)}><div className="form-grid"><label>Decision<select name="status" defaultValue={submission.status}><option value="submitted">Under review</option><option value="more_info">Request more information</option><option value="accepted">Accept</option><option value="declined">Decline</option></select></label><label>Response<textarea name="response" defaultValue={submission.response} maxLength={1500} placeholder="Explain the next step or decision…" /></label></div><button className="button" type="submit">Save response</button></form></article>) : <div className="panel empty"><h3>No applications yet</h3><p>Share <b>rycp.pro/a/{slug}</b> to receive the first response.</p></div>}</section>}
    </>}
  </main></>;
}
