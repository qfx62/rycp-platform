import type { Metadata } from "next";
import Link from "next/link";
import ApplicationForm from "../../../components/ApplicationForm";
import { applicationPage } from "../../../lib/db";
import { getSession } from "../../../lib/session";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await applicationPage((await params).slug);
  if (!page) return { title: "Application unavailable" };
  return { title: `${page.serverName} Staff Application`, description: page.description || `Apply to ${page.serverName} using your RYCP profile.` };
}

export default async function ServerApplication({ params }: PageProps) {
  const { slug } = await params;
  const [page, user] = await Promise.all([applicationPage(slug), getSession()]);
  if (!page) return <main className="application-state"><img src="/logo.png" alt="RYCP" /><h1>Application unavailable</h1><p>This link does not exist or is no longer available.</p><Link className="button secondary" href="/">Return to RYCP</Link></main>;

  return <main className="application-page" style={{ "--application-accent": page.accentColor } as React.CSSProperties}>
    <div className="application-brand"><Link href="/"><img src="/logo.png" alt="" />RYCP</Link><span>Secure staff applications</span></div>
    <section className="application-shell">
      <header className="application-server-card">
        <img src={page.iconUrl || "/logo.png"} alt="" />
        <div><span>{page.verified ? "Verified RYCP server" : "RYCP server application"}</span><h1>{page.title}</h1><strong>{page.serverName}</strong></div>
      </header>
      {page.description && <p className="application-description">{page.description}</p>}
      <div className="application-explainer"><div><b>1</b><span><strong>Sign in</strong><small>Use your verified Discord identity.</small></span></div><div><b>2</b><span><strong>Answer once</strong><small>Complete the server’s questions.</small></span></div><div><b>3</b><span><strong>Management reviews</strong><small>Your answers stay private.</small></span></div></div>
      {page.status === "closed" ? <div className="application-closed"><h2>Applications are currently closed</h2><p>{page.serverName} is not accepting responses through this page right now.</p></div> : user ? <ApplicationForm slug={slug} questions={page.questions} /> : <div className="application-login"><h2>Continue with Discord</h2><p>RYCP uses Discord login to attach your identity and public reputation profile to the application.</p><a className="button" href={`/login?returnTo=/a/${encodeURIComponent(slug)}`}>Login and start application</a></div>}
    </section>
    <footer className="application-footer"><span>Powered by RYCP</span><Link href="/">Build your reputation profile</Link></footer>
  </main>;
}
