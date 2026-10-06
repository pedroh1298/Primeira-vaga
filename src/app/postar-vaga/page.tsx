"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function PostarVagaPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("remoto");
  const [salaryRange, setSalaryRange] = useState("");
  const [requirements, setRequirements] = useState("");
  const [area, setArea] = useState("");
  const [employmentType, setEmploymentType] = useState("estagio");
  const [educationLevel, setEducationLevel] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [optionalSkills, setOptionalSkills] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [slots, setSlots] = useState("1");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("edit");
    const initialize = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      if (!authData.user) { router.replace(`/login?next=${encodeURIComponent(id ? `/postar-vaga?edit=${id}` : "/postar-vaga")}`); return; }
      const { data: ownerProfile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      if (!active) return;
      if (ownerProfile?.role !== "empresa") { setError("Apenas perfis de empresa podem publicar vagas."); return; }
      if (id) {
        setEditId(id);
        const { data: ownCompany } = await supabase.from("companies").select("id").eq("user_id", authData.user.id).maybeSingle();
        const { data, error: jobError } = await supabase.from('jobs').select('*').eq('id', id).eq('company_id', ownCompany?.id ?? "").maybeSingle();
        if (!active) return;
        if (data) {
          setTitle(data.title);
          setDescription(data.description);
          setLocation(data.location);
          setType(data.type);
          setSalaryRange(data.salary_range || "");
          setRequirements((data.requirements || []).join("\n"));
          setArea(data.area || ""); setEmploymentType(data.employment_type || "estagio");
          setEducationLevel(data.education_level || ""); setRequiredSkills((data.required_skills || []).join(", "));
          setOptionalSkills((data.optional_skills || []).join(", ")); setWorkSchedule(data.work_schedule || "");
          setSlots(String(data.slots || 1)); setApplicationDeadline(data.application_deadline || ""); setIsActive(data.is_active ?? true);
        } else if (jobError || !data) {
          setError("Vaga não encontrada ou você não tem permissão para editá-la.");
        }
      }
    };
    void initialize();
    return () => { active = false; };
  }, [router, supabase]);

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError("Você precisa estar logado para postar uma vaga.");
      setIsLoading(false);
      return;
    }

    // Usually we would link to a companies table, but let's safely ensure the user is an 'empresa'
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== 'empresa') {
      setError("Apenas usuários com perfil de empresa podem postar vagas.");
      setIsLoading(false);
      return;
    }

    // A vaga só pode ser publicada depois que a empresa estiver identificada.
    const { data: company, error: companyFetchError } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userData.user.id)
      .single();

    if (companyFetchError && companyFetchError.code !== 'PGRST116') {
      setError(companyFetchError.message);
      setIsLoading(false);
      return;
    }

    if (!company) { setError("Complete o perfil da empresa antes de publicar uma vaga."); setIsLoading(false); router.push("/cadastro-empresa"); return; }
    const companyId = company.id;

    // Insert job
    const reqArray = requirements.split("\n").map((requirement) => requirement.trim()).filter(Boolean);
    const commaList = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

    if (!area || !educationLevel || commaList(requiredSkills).length === 0 || description.trim().length < 80 || !workSchedule) {
      setError("Preencha área, escolaridade, jornada, descrição completa e ao menos uma habilidade obrigatória."); setIsLoading(false); return;
    }

    const payload = {
      company_id: companyId,
      title,
      description,
      location,
      type,
      salary_range: salaryRange,
      requirements: reqArray,
      area,
      employment_type: employmentType,
      education_level: educationLevel,
      required_skills: commaList(requiredSkills),
      optional_skills: commaList(optionalSkills),
      work_schedule: workSchedule.trim(),
      slots: Number(slots),
      application_deadline: applicationDeadline || null,
      is_active: isActive,
    };

    let jobError;
    if (editId) {
      const { data: updatedJob, error } = await supabase.from("jobs").update(payload).eq('id', editId).eq("company_id", companyId).select("id").maybeSingle();
      jobError = error ?? (!updatedJob ? new Error("Vaga não encontrada ou sem permissão para editar.") : null);
    } else {
      const { error } = await supabase.from("jobs").insert(payload);
      jobError = error;
    }

    if (jobError) {
      setError(jobError.message);
    } else {
      setSuccess(editId ? "Vaga atualizada com sucesso!" : "Vaga postada com sucesso!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    }

    setIsLoading(false);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{editId ? "Editar Vaga" : "Postar Nova Vaga"}</h1>
        <p className="mt-2 text-zinc-400">Preencha os detalhes da oportunidade abaixo.</p>
      </div>

      <form onSubmit={handlePostJob} className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-8">
        {error && (
          <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-500 border border-green-500/20">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-zinc-300">Título da Vaga</label>
            <input
              type="text"
              required
              minLength={4}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Ex: Desenvolvedor Front-end Junior"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Área profissional</label><select className="input" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Selecione...</option><option value="tecnologia">Tecnologia</option><option value="marketing">Marketing</option><option value="administracao">Administração</option><option value="design">Design</option><option value="vendas">Vendas</option><option value="atendimento">Atendimento</option><option value="logistica">Logística</option><option value="financeiro">Financeiro</option><option value="recursos_humanos">Recursos Humanos</option><option value="engenharia">Engenharia</option><option value="outro">Outra</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Vínculo</label><select className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}><option value="estagio">Estágio</option><option value="jovem_aprendiz">Jovem aprendiz</option><option value="clt">CLT</option><option value="temporario">Temporário</option><option value="pj">Pessoa jurídica</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-zinc-300">Escolaridade mínima</label><select className="input" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}><option value="">Selecione...</option><option value="fundamental">Fundamental</option><option value="medio_cursando">Médio cursando</option><option value="medio_completo">Médio completo</option><option value="tecnico_cursando">Técnico cursando</option><option value="tecnico_completo">Técnico completo</option><option value="superior_cursando">Superior cursando</option><option value="superior_completo">Superior completo</option></select></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Localização</label>
            <input
              type="text"
              required
              minLength={3}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Ex: São Paulo, SP (ou Remoto)"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Tipo de Vaga</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="remoto">Remoto</option>
              <option value="híbrido">Híbrido</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Faixa Salarial (Opcional)</label>
          <input
            type="text"
            value={salaryRange}
            onChange={(e) => setSalaryRange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Ex: R$ 2.000 - R$ 3.000"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-zinc-300">Jornada e horário</label><input className="input" value={workSchedule} onChange={(e) => setWorkSchedule(e.target.value)} placeholder="30h semanais, segunda a sexta, 9h às 15h" /></div><div><label className="mb-2 block text-sm font-medium text-zinc-300">Quantidade de vagas</label><input type="number" min="1" max="1000" className="input" value={slots} onChange={(e) => setSlots(e.target.value)} /></div></div>

        <div className="grid gap-6 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-zinc-300">Habilidades obrigatórias</label><input className="input" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="Excel, comunicação, JavaScript" /><p className="mt-1 text-xs text-zinc-500">Separe por vírgulas. Esses itens têm maior peso na compatibilidade.</p></div><div><label className="mb-2 block text-sm font-medium text-zinc-300">Habilidades desejáveis</label><input className="input" value={optionalSkills} onChange={(e) => setOptionalSkills(e.target.value)} placeholder="Power BI, inglês básico" /></div></div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Descrição da Vaga</label>
          <textarea
            required
            minLength={80}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Descreva as responsabilidades e o dia a dia da vaga..."
          />
        </div>

        <div className="grid items-end gap-6 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-zinc-300">Prazo para candidatura</label><input type="date" className="input" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} /></div>{editId && <label className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-300"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Vaga ativa e recebendo candidaturas</label>}</div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Requisitos (Um por linha)</label>
          <textarea
            required
            minLength={3}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Ex: Conhecimento em React&#10;Lógica de programação&#10;Inglês técnico"
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
          {isLoading ? (editId ? "Atualizando..." : "Postando...") : (editId ? "Atualizar Vaga" : "Postar Vaga")}
        </Button>
      </form>
    </div>
  );
}
