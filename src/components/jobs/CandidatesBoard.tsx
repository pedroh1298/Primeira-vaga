"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, FileText, GraduationCap, MapPin, Search, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationActions } from "@/components/jobs/ApplicationActions";

type Candidate = {
  id: string; status: string; created_at: string; compatibility_score: number; compatibility_breakdown: Record<string, { pontos?: number; maximo?: number }>;
  jobs: { id: string; title: string } | null;
  profiles: { id: string; name: string; headline?: string; bio?: string; area?: string; city?: string; state?: string; education_level?: string; course?: string; institution?: string; skills?: string[]; languages?: string[]; availability?: string[]; preferred_work_models?: string[]; experience_summary?: string; linkedin_url?: string; portfolio_url?: string; resume_url?: string } | null;
};

const statusLabels: Record<string, string> = { em_analise: "Em análise", entrevista: "Entrevista", aprovado: "Aprovado", recusado: "Não selecionado" };
const educationLabels: Record<string, string> = { fundamental: "Ensino fundamental", medio_cursando: "Médio cursando", medio_completo: "Médio completo", tecnico_cursando: "Técnico cursando", tecnico_completo: "Técnico completo", superior_cursando: "Superior cursando", superior_completo: "Superior completo", pos_graduacao: "Pós-graduação" };

export function CandidatesBoard({ applications }: { applications: Candidate[] }) {
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("score");
  const jobs = useMemo(() => [...new Map(applications.filter((item) => item.jobs).map((item) => [item.jobs!.id, item.jobs!])).values()], [applications]);
  const filtered = useMemo(() => applications.filter((item) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const haystack = [item.profiles?.name, item.profiles?.headline, item.profiles?.area, ...(item.profiles?.skills ?? [])].join(" ").toLocaleLowerCase("pt-BR");
    return (!term || haystack.includes(term)) && (jobId === "all" || item.jobs?.id === jobId) && (status === "all" || item.status === status);
  }).sort((a, b) => sort === "score" ? b.compatibility_score - a.compatibility_score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [applications, jobId, search, sort, status]);

  return <div>
    <div className="mb-8 grid gap-3 rounded-xl border border-white/5 bg-zinc-900 p-4 md:grid-cols-4">
      <label className="relative"><span className="sr-only">Buscar candidato</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" /><input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou habilidade" /></label>
      <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="all">Todas as vagas</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todas as etapas</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}><option value="score">Maior compatibilidade</option><option value="recent">Mais recentes</option></select>
    </div>

    {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-zinc-400">Nenhum candidato corresponde aos filtros.</div> : <div className="space-y-5">{filtered.map((application) => {
      const profile = application.profiles; const score = application.compatibility_score ?? 0;
      return <article key={application.id} className="rounded-xl border border-white/5 bg-zinc-900 p-5 md:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-purple-900 text-lg font-bold text-white">{profile?.name?.charAt(0) ?? <User className="h-5 w-5" />}</div><div className="min-w-0"><h2 className="text-lg font-bold text-white">{profile?.name ?? "Candidato"}</h2><p className="text-sm text-purple-300">{profile?.headline ?? "Objetivo não informado"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400"><span className="flex items-center gap-1"><BriefcaseBusiness className="h-3.5 w-3.5" />{application.jobs?.title}</span><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile?.city ? `${profile.city}/${profile.state}` : "Local não informado"}</span><span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{educationLabels[profile?.education_level ?? ""] ?? "Escolaridade não informada"}</span></div></div></div>
          <div className="flex items-center gap-4 lg:border-l lg:border-white/10 lg:pl-6"><Score score={score} /><ApplicationActions applicationId={application.id} candidateId={profile?.id ?? ""} initialStatus={application.status} /></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{(profile?.skills ?? []).map((skill) => <span key={skill} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{skill}</span>)}</div>
        <details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold text-purple-300">Ver análise completa</summary><div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 text-sm text-zinc-300"><p>{profile?.bio ?? "Sem apresentação."}</p>{profile?.experience_summary && <div><h3 className="mb-1 font-semibold text-white">Projetos e experiências</h3><p className="whitespace-pre-wrap text-zinc-400">{profile.experience_summary}</p></div>}<p><strong className="text-white">Formação:</strong> {[profile?.course, profile?.institution].filter(Boolean).join(" — ") || "Não detalhada"}</p><p><strong className="text-white">Disponibilidade:</strong> {(profile?.availability ?? []).join(", ") || "Não informada"}</p><p><strong className="text-white">Modelos aceitos:</strong> {(profile?.preferred_work_models ?? []).join(", ") || "Não informados"}</p></div>
          <div><h3 className="mb-3 flex items-center gap-2 font-semibold text-white"><Sparkles className="h-4 w-4 text-purple-400" />Composição da compatibilidade</h3><div className="space-y-2">{Object.entries(application.compatibility_breakdown ?? {}).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-2 text-sm"><span className="capitalize text-zinc-400">{key.replaceAll("_", " ")}</span><span className="font-semibold text-white">{value.pontos ?? 0}/{value.maximo ?? 0}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{profile?.resume_url && <Button size="sm" variant="outline" asChild><a href={profile.resume_url} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />Currículo</a></Button>}{profile?.linkedin_url && <Button size="sm" variant="outline" asChild><a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></Button>}{profile?.portfolio_url && <Button size="sm" variant="outline" asChild><a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">Portfólio</a></Button>}</div></div>
        </div></details>
      </article>;
    })}</div>}
  </div>;
}

function Score({ score }: { score: number }) { const color = score >= 75 ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : score >= 50 ? "text-amber-300 border-amber-500/30 bg-amber-500/10" : "text-zinc-300 border-white/10 bg-zinc-800"; return <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-full border ${color}`}><div className="text-center"><strong className="block text-xl">{score}%</strong><span className="text-[9px] uppercase tracking-wide">compatível</span></div></div>; }
