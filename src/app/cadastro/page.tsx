"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileText, Loader2, Upload } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { DeleteAccountBtn } from "@/components/profile/DeleteAccountBtn";
import { createClient } from "@/lib/supabase/client";

const areas = [
  ["tecnologia", "Tecnologia"], ["marketing", "Marketing"], ["administracao", "Administração"],
  ["design", "Design"], ["vendas", "Vendas"], ["atendimento", "Atendimento"],
  ["logistica", "Logística"], ["financeiro", "Financeiro"], ["recursos_humanos", "Recursos Humanos"],
  ["engenharia", "Engenharia"], ["outro", "Outra área"],
];
const educationOptions = [
  ["fundamental", "Ensino fundamental"], ["medio_cursando", "Ensino médio cursando"],
  ["medio_completo", "Ensino médio completo"], ["tecnico_cursando", "Técnico cursando"],
  ["tecnico_completo", "Técnico completo"], ["superior_cursando", "Superior cursando"],
  ["superior_completo", "Superior completo"], ["pos_graduacao", "Pós-graduação"],
];
const availabilityOptions = [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"], ["integral", "Horário integral"], ["fins_de_semana", "Fins de semana"]];
const workModelOptions = [["remoto", "Remoto"], ["híbrido", "Híbrido"], ["presencial", "Presencial"]];

type CandidateForm = {
  area: string; headline: string; bio: string; phone: string; city: string; state: string;
  educationLevel: string; course: string; institution: string; graduationYear: string;
  availability: string[]; preferredWorkModels: string[]; skills: string; languages: string;
  linkedinUrl: string; portfolioUrl: string; experienceSummary: string;
};

const initialForm: CandidateForm = {
  area: "", headline: "", bio: "", phone: "", city: "", state: "", educationLevel: "",
  course: "", institution: "", graduationYear: "", availability: [], preferredWorkModels: [],
  skills: "", languages: "", linkedinUrl: "", portfolioUrl: "", experienceSummary: "",
};

export default function CadastroCurriculoPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CandidateForm>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      if (!data.user) { router.replace("/login?next=/cadastro"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("area, headline, bio, phone, city, state, education_level, course, institution, graduation_year, availability, preferred_work_models, skills, languages, linkedin_url, portfolio_url, experience_summary, resume_url").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      if (profileError) setError("Não foi possível carregar seu perfil. Confira se a migração mais recente foi aplicada no Supabase.");
      if (profile) {
        const legacyArea: Record<string, string> = { ti: "tecnologia", mkt: "marketing", adm: "administracao" };
        setForm({
          area: legacyArea[profile.area] ?? profile.area ?? "", headline: profile.headline ?? "", bio: profile.bio ?? "",
          phone: profile.phone ?? "", city: profile.city ?? "", state: profile.state ?? "",
          educationLevel: profile.education_level ?? "", course: profile.course ?? "", institution: profile.institution ?? "",
          graduationYear: profile.graduation_year?.toString() ?? "", availability: profile.availability ?? [],
          preferredWorkModels: profile.preferred_work_models ?? [], skills: (profile.skills ?? []).join(", "),
          languages: (profile.languages ?? []).join(", "), linkedinUrl: profile.linkedin_url ?? "",
          portfolioUrl: profile.portfolio_url ?? "", experienceSummary: profile.experience_summary ?? "",
        });
        setHasResume(Boolean(profile.resume_url));
      }
      setIsLoadingProfile(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [router, supabase]);

  const update = <K extends keyof CandidateForm>(field: K, value: CandidateForm[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggle = (field: "availability" | "preferredWorkModels", value: string) => update(field, form[field].includes(value) ? form[field].filter((item) => item !== value) : [...form[field], value]);
  const list = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

  const validateStep = () => {
    setError(null);
    if (step === 1 && (!form.area || form.headline.trim().length < 5 || form.bio.trim().length < 40 || !form.city || form.state.length !== 2)) {
      setError("Preencha área, objetivo profissional, cidade, UF e uma apresentação com pelo menos 40 caracteres.");
      return false;
    }
    if (step === 2 && (!form.educationLevel || !form.institution.trim() || list(form.skills).length < 3 || form.availability.length === 0 || form.preferredWorkModels.length === 0)) {
      setError("Informe sua escolaridade e instituição, pelo menos 3 habilidades, disponibilidade e modelo de trabalho preferido.");
      return false;
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) { setStep((value) => Math.min(3, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") { setError("Apenas arquivos PDF são permitidos."); return; }
    if (selected.size > 5 * 1024 * 1024) { setError("O arquivo deve ter no máximo 5 MB."); return; }
    setFile(selected); setError(null);
  };

  const handleComplete = async () => {
    if (!user) { setError("Você precisa estar logado."); return; }
    if (!hasResume && !file) { setError("Adicione seu currículo em PDF para concluir o perfil."); return; }
    setIsLoading(true); setError(null);
    try {
      let resumeUrl: string | undefined;
      if (file) {
        const path = `${user.id}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from("curriculos").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (uploadError) throw uploadError;
        resumeUrl = supabase.storage.from("curriculos").getPublicUrl(path).data.publicUrl;
      }
      const graduationYear = form.graduationYear ? Number(form.graduationYear) : null;
      const { error: updateError } = await supabase.from("profiles").update({
        area: form.area, headline: form.headline.trim(), bio: form.bio.trim(), phone: form.phone.trim() || null,
        city: form.city.trim(), state: form.state.trim().toUpperCase(), education_level: form.educationLevel,
        course: form.course.trim() || null, institution: form.institution.trim() || null, graduation_year: graduationYear,
        availability: form.availability, preferred_work_models: form.preferredWorkModels, skills: list(form.skills),
        languages: list(form.languages), linkedin_url: form.linkedinUrl.trim() || null,
        portfolio_url: form.portfolioUrl.trim() || null, experience_summary: form.experienceSummary.trim() || null,
        ...(resumeUrl ? { resume_url: resumeUrl } : {}),
      }).eq("id", user.id);
      if (updateError) throw updateError;
      router.push("/dashboard"); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o perfil.");
    } finally { setIsLoading(false); }
  };

  if (isLoadingProfile) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center"><h1 className="text-3xl font-bold">Seu perfil profissional</h1><p className="mt-3 text-zinc-400">Informações completas ajudam recrutadores a entender seu potencial antes da entrevista.</p></div>
      <div className="mb-10 grid grid-cols-3 gap-2">{["Perfil", "Formação e habilidades", "Currículo"].map((label, index) => <div key={label} className={`border-b-2 pb-3 text-center text-xs sm:text-sm ${step >= index + 1 ? "border-purple-500 text-white" : "border-zinc-800 text-zinc-600"}`}><span className="mr-1 font-bold">{index + 1}.</span>{label}</div>)}</div>
      {error && <div role="alert" className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6 md:p-8">
        {step === 1 && <div className="space-y-6">
          <div className="flex justify-center"><AvatarUpload userId={user!.id} /></div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Área de interesse"><select value={form.area} onChange={(event) => update("area", event.target.value)} className="input"><option value="">Selecione...</option>{areas.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Objetivo profissional"><input value={form.headline} onChange={(event) => update("headline", event.target.value)} className="input" placeholder="Ex: Estágio em desenvolvimento front-end" /></Field>
            <Field label="Cidade"><input value={form.city} onChange={(event) => update("city", event.target.value)} className="input" placeholder="Fortaleza" /></Field>
            <Field label="UF"><input value={form.state} maxLength={2} onChange={(event) => update("state", event.target.value.toUpperCase())} className="input uppercase" placeholder="CE" /></Field>
            <Field label="Telefone (opcional)"><input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="input" placeholder="(85) 99999-9999" /></Field>
          </div>
          <Field label="Apresentação profissional"><textarea value={form.bio} onChange={(event) => update("bio", event.target.value)} className="input min-h-32 resize-none" placeholder="Conte o que você estuda, seus interesses e o que busca na primeira oportunidade." /><p className="mt-1 text-right text-xs text-zinc-500">{form.bio.length}/40 caracteres mínimos</p></Field>
        </div>}

        {step === 2 && <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Escolaridade"><select value={form.educationLevel} onChange={(event) => update("educationLevel", event.target.value)} className="input"><option value="">Selecione...</option>{educationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Curso"><input value={form.course} onChange={(event) => update("course", event.target.value)} className="input" placeholder="Ex: Análise e Desenvolvimento de Sistemas" /></Field>
            <Field label="Instituição"><input value={form.institution} onChange={(event) => update("institution", event.target.value)} className="input" placeholder="Nome da escola ou faculdade" /></Field>
            <Field label="Ano de conclusão previsto"><input type="number" min="1950" max="2100" value={form.graduationYear} onChange={(event) => update("graduationYear", event.target.value)} className="input" placeholder="2027" /></Field>
          </div>
          <Field label="Habilidades (separe por vírgulas)"><input value={form.skills} onChange={(event) => update("skills", event.target.value)} className="input" placeholder="Excel, atendimento ao cliente, JavaScript" /></Field>
          <Field label="Idiomas (opcional, separe por vírgulas)"><input value={form.languages} onChange={(event) => update("languages", event.target.value)} className="input" placeholder="Português nativo, Inglês básico" /></Field>
          <ChoiceGroup label="Disponibilidade" options={availabilityOptions} selected={form.availability} onToggle={(value) => toggle("availability", value)} />
          <ChoiceGroup label="Modelos de trabalho aceitos" options={workModelOptions} selected={form.preferredWorkModels} onToggle={(value) => toggle("preferredWorkModels", value)} />
          <Field label="Projetos, atividades ou experiências"><textarea value={form.experienceSummary} onChange={(event) => update("experienceSummary", event.target.value)} className="input min-h-28 resize-none" placeholder="Vale projeto escolar, voluntariado, trabalho informal, curso prático ou projeto pessoal." /></Field>
          <div className="grid gap-5 md:grid-cols-2"><Field label="LinkedIn (opcional)"><input type="url" value={form.linkedinUrl} onChange={(event) => update("linkedinUrl", event.target.value)} className="input" placeholder="https://linkedin.com/in/..." /></Field><Field label="Portfólio ou GitHub (opcional)"><input type="url" value={form.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} className="input" placeholder="https://github.com/..." /></Field></div>
        </div>}

        {step === 3 && <div className="space-y-6">
          <div className="text-center"><FileText className="mx-auto h-9 w-9 text-purple-400" /><h2 className="mt-3 text-xl font-semibold">Currículo em PDF</h2><p className="mt-2 text-sm text-zinc-400">O recrutador poderá abrir o documento na análise da candidatura.</p></div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={`w-full rounded-xl border-2 border-dashed p-10 text-center transition-colors ${file || hasResume ? "border-purple-500 bg-purple-500/5" : "border-zinc-700 bg-zinc-950 hover:border-purple-500/60"}`}>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
            {file || hasResume ? <Check className="mx-auto h-8 w-8 text-purple-400" /> : <Upload className="mx-auto h-8 w-8 text-zinc-500" />}
            <p className="mt-3 font-medium text-white">{file?.name ?? (hasResume ? "Currículo já cadastrado" : "Clique para selecionar o PDF")}</p><p className="mt-1 text-sm text-zinc-500">Máximo de 5 MB</p>
          </button>
        </div>}

        <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          {step === 1 ? <DeleteAccountBtn /> : <Button variant="ghost" onClick={() => { setError(null); setStep((value) => value - 1); }}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>}
          {step < 3 ? <Button onClick={nextStep}>Próximo passo<ChevronRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={handleComplete} disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar perfil profissional"}</Button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-zinc-300"><span className="mb-2 block">{label}</span>{children}</label>; }
function ChoiceGroup({ label, options, selected, onToggle }: { label: string; options: string[][]; selected: string[]; onToggle: (value: string) => void }) { return <fieldset><legend className="mb-3 text-sm font-medium text-zinc-300">{label}</legend><div className="flex flex-wrap gap-2">{options.map(([value, text]) => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onToggle(value)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${selected.includes(value) ? "border-purple-500 bg-purple-500/20 text-purple-200" : "border-white/10 bg-zinc-950 text-zinc-400 hover:border-purple-500/40"}`}>{text}</button>)}</div></fieldset>; }
