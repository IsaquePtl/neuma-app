import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Neuma",
  alternates: { canonical: "https://www.comunidadeneuma.com/privacidade" },
};

export default function PrivacidadePage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>
        A Comunidade Neuma é uma plataforma de mentoria musical 1:1. Esta página
        explica que dados tratamos, para quê e com quem.
      </p>

      <h2>Dados que recolhemos</h2>
      <ul>
        <li>Conta: nome, email, idade, género e fotografia de perfil (opcional).</li>
        <li>Percurso: respostas de onboarding, check-ins, vídeos e ficheiros que envias.</li>
        <li>Sessões: marcações de chamadas com o mentor.</li>
        <li>Pagamentos: estado da subscrição. Os dados do cartão ficam só na Stripe.</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Criar e manter o teu percurso e o acompanhamento do mentor.</li>
        <li>Enviar emails de serviço (acesso, recuperação de password, avisos).</li>
        <li>Gerir subscrições e faturação.</li>
      </ul>

      <h2>Subcontratantes</h2>
      <ul>
        <li>Supabase — base de dados e autenticação.</li>
        <li>Vercel — alojamento da aplicação.</li>
        <li>Cloudflare R2 — armazenamento de vídeos e ficheiros.</li>
        <li>Stripe — pagamentos.</li>
        <li>Cal.com — marcação de sessões.</li>
        <li>Tally — formulários.</li>
        <li>Resend — envio de email.</li>
      </ul>

      <h2>Os teus direitos</h2>
      <p>
        Podes pedir acesso, correção ou eliminação dos teus dados a qualquer
        momento através de{" "}
        <a className="underline" href="mailto:isaqueportilho2014@gmail.com">
          isaqueportilho2014@gmail.com
        </a>
        .
      </p>
    </>
  );
}
