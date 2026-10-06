"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { DeleteAccountBtn } from "@/components/profile/DeleteAccountBtn";
import { createClient } from "@/lib/supabase/client";

type CompanyForm = { name: string; description: string; website: string; industry: string; companySize: string; city: string; state: string; culture: string; benefits: string; contactName: string; contactRole: string };
const emptyForm: CompanyForm = { name: "", description: "", website: "", industry: "", companySize: "", city: "", state: "", culture: "", benefits: "", contactName: "", contactRole: "" };

export default function CadastroEmpresaPage() {
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const update = (field: keyof CompanyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    let active = true;
    async function loadData() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      if (!data.user) { router.replace("/login?next=/cadastro-empresa"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, name").eq("id", data.user.id).maybeSingle();
      if (profile?.role !== "empresa") { setError("Esta área é exclusiva para perfis de empresa."); setIsLoadingProfile(false); return; }
      const { data: company, error: companyError } = await supabase.from("companies").select("name, description, website, industry, company_size, city, state, culture, benefits, contact_name, contact_role").eq("user_id", data.user.id).maybeSingle();
      if (companyError) setError("Não foi possível carregar a empresa. Confira se a migração mais recente foi aplicada.");
      setForm({
        name: company?.name ?? profile.name ?? "", description: company?.description ?? "", website: company?.website ?? "",
        industry: company?.industry ?? "", companySize: company?.company_size ?? "", city: company?.city ?? "", state: company?.state ?? "",
        culture: company?.culture ?? "", benefits: (company?.benefits ?? []).join(", "), contactName: company?.contact_name ?? "", contactRole: company?.contact_role ?? "",
      });
      setIsLoadingProfile(false);
    }
    void loadData();
    return () => { active = false; };
  }, [router, supabase]);

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { setError("Você precisa estar logado."); return; }
    if (form.name.trim().length < 2 || form.description.trim().length < 80 || !form.industry || !form.companySize || !form.city || form.state.length !== 2 || form.culture.trim().length < 30 || !form.contactName || !form.contactRole) {
      setError("Preencha os dados obrigatórios. A descrição deve ter 80 caracteres e a cultura, 30 caracteres."); return;
    }
    setIsLoading(true); setError(null); setSuccess(null);
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "empresa") { setError("Apenas empresas podem salvar este perfil."); setIsLoading(false); return; }
    const payload = {
      user_id: user.id, name: form.name.trim(), description: form.description.trim(), website: form.website.trim() || null,
      industry: form.industry, company_size: form.companySize, city: form.city.trim(), state: form.state.toUpperCase(), culture: form.culture.trim(),
      benefits: [...new Set(form.benefits.split(",").map((item) => item.trim()).filter(Boolean))], contact_name: form.contactName.trim(), contact_role: form.contactRole.trim(),
    };
    const { error: saveError } = await supabase.from("companies").upsert(payload, { onConflict: "user_id" });
    if (saveError) setError(saveError.message);
    else { setSuccess("Perfil empresarial salvo."); setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 700); }
    setIsLoading(false);
  };

  if (isLoadingProfile) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>;

  return <div className="container mx-auto max-w-4xl px-4 py-12">
    <div className="mb-8 text-center"><h1 className="text-3xl font-bold">Perfil da empresa</h1><p className="mt-3 text-zinc-400">Transparência sobre cultura, porte e benefícios melhora a qualidade das candidaturas.</p></div>
    <form onSubmit={handleComplete} className="space-y-6 rounded-2xl border border-white/5 bg-zinc-900 p-6 md:p-8">
      <div className="flex justify-center">{user && <AvatarUpload userId={user.id} />}</div>
      {error && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300"><CheckCircle2 className="h-5 w-5" />{success}</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome da empresa"><input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
        <Field label="Segmento"><input className="input" value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="Tecnologia, varejo, saúde..." /></Field>
        <Field label="Porte"><select className="input" value={form.companySize} onChange={(e) => update("companySize", e.target.value)}><option value="">Selecione...</option><option value="1-10">1 a 10 pessoas</option><option value="11-50">11 a 50 pessoas</option><option value="51-200">51 a 200 pessoas</option><option value="201-1000">201 a 1.000 pessoas</option><option value="1000+">Mais de 1.000 pessoas</option></select></Field>
        <Field label="Website (opcional)"><input type="url" className="input" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://empresa.com.br" /></Field>
        <Field label="Cidade"><input className="input" value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
        <Field label="UF"><input className="input uppercase" maxLength={2} value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase())} /></Field>
      </div>
      <Field label="Sobre a empresa"><textarea className="input min-h-36 resize-none" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="História, produto, clientes e momento atual da empresa." /></Field>
      <Field label="Cultura e ambiente"><textarea className="input min-h-28 resize-none" value={form.culture} onChange={(e) => update("culture", e.target.value)} placeholder="Como a equipe trabalha, aprende e toma decisões?" /></Field>
      <Field label="Benefícios (separe por vírgulas)"><input className="input" value={form.benefits} onChange={(e) => update("benefits", e.target.value)} placeholder="Vale-transporte, curso de idiomas, horário flexível" /></Field>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Responsável pelo recrutamento"><input className="input" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} /></Field><Field label="Cargo do responsável"><input className="input" value={form.contactRole} onChange={(e) => update("contactRole", e.target.value)} placeholder="Analista de RH" /></Field></div>
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row"><DeleteAccountBtn /><Button type="submit" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar perfil da empresa"}</Button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-zinc-300"><span className="mb-2 block">{label}</span>{children}</label>; }
