import Link from "next/link";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { CandidatesBoard } from "@/components/jobs/CandidatesBoard";

export default async function CandidatosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/candidatos');

  // Ensure they are an empresa
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profile?.role !== 'empresa') {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
        <p className="text-zinc-400 mb-8">Esta página é restrita para empresas visualizar currículos.</p>
        <Button asChild><Link href="/dashboard">Voltar ao Início</Link></Button>
      </div>
    );
  }

  // Get company
  const { data: company } = await supabase.from('companies').select('*').eq('user_id', user.id).single();
  
  if (!company) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Empresa Não Encontrada</h1>
        <p className="text-zinc-400">Você precisa ter um perfil de empresa válido.</p>
      </div>
    );
  }

  const { data: myJobs } = await supabase.from('jobs').select('id, title').eq('company_id', company.id);
  const myJobIds = myJobs?.map(j => j.id) || [];
  const { data: companyApplications } = myJobIds.length > 0
    ? await supabase
        .from('applications')
        .select('id, status, created_at, compatibility_score, compatibility_breakdown, jobs(id, title), profiles(id, name, headline, bio, area, city, state, education_level, course, institution, skills, languages, availability, preferred_work_models, experience_summary, linkedin_url, portfolio_url, resume_url)')
        .in('job_id', myJobIds)
        .order('created_at', { ascending: false })
    : { data: [] };
  const applicationsList = companyApplications ?? [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-12 border-b border-white/5 pb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          <User className="h-8 w-8 text-purple-500" /> Banco de Currículos Recebidos
        </h1>
        <p className="text-zinc-400">Analise os candidatos que aplicaram para suas vagas publicadas.</p>
      </div>

      {applicationsList.length === 0 ? (
          <div className="text-center bg-zinc-900 border border-white/5 rounded-xl p-12">
            <h3 className="text-xl font-bold text-white mb-2">Nenhum candidato ainda</h3>
            <p className="text-zinc-400">Assim que os candidatos aplicarem nas suas vagas, os currículos aparecerão aqui.</p>
          </div>
        ) : <CandidatesBoard applications={applicationsList as any} />}
    </div>
  );
}
