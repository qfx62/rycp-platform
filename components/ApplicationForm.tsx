"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { ApplicationQuestion } from "../lib/db";

export default function ApplicationForm({ slug, questions }: { slug: string; questions: ApplicationQuestion[] }) {
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const response = await fetch(`/api/application-pages/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: Object.fromEntries(new FormData(form)) }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not submit your application.");
      return;
    }
    form.reset();
    setSubmitted(true);
  }

  if (submitted) return <div className="application-complete"><strong>Application submitted</strong><p>Your answers were sent securely to the server’s management team.</p><Link className="button secondary" href="/dashboard">Open my RYCP profile</Link></div>;

  return <form className="public-application-form" onSubmit={submitApplication}>
    {questions.map((question, index) => <label key={question.id}>
      <span><b>{index + 1}. {question.label}</b>{question.required && <small>Required</small>}</span>
      {question.type === "long" && <textarea name={question.id} required={question.required} maxLength={2000} />}
      {question.type === "short" && <input name={question.id} required={question.required} maxLength={400} />}
      {question.type === "yes_no" && <select name={question.id} required={question.required} defaultValue=""><option value="" disabled>Select an answer</option><option>Yes</option><option>No</option></select>}
    </label>)}
    {error && <p className="form-error">{error}</p>}
    <button className="button" type="submit">Submit application</button>
    <small className="application-privacy">Your answers are only visible to authorized server management.</small>
  </form>;
}
