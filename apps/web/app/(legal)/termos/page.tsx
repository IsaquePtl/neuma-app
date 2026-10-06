import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Utilização — Neuma",
  alternates: { canonical: "https://www.comunidadeneuma.com/termos" },
};

export default function TermosPage() {
  return (
    <>
      <h1>Termos de Utilização</h1>
      <p>
        Ao criar conta na Comunidade Neuma aceitas estes termos. O serviço é
        prestado por Isaque Portilho, mentor responsável pela plataforma.
      </p>

      <h2>O serviço</h2>
      <p>
        Mentoria musical 1:1 com percurso personalizado, conteúdos por nível,
        check-ins com feedback e sessões marcadas com o mentor.
      </p>

      <h2>Conta</h2>
      <ul>
        <li>A conta é pessoal; não partilhes o acesso.</li>
        <li>Os conteúdos do percurso são para uso pessoal e não podem ser redistribuídos.</li>
      </ul>

      <h2>Subscrição e pagamentos</h2>
      <ul>
        <li>Os pagamentos são processados pela Stripe.</li>
        <li>Podes gerir ou cancelar a subscrição nas definições da conta.</li>
      </ul>

      <h2>Contacto</h2>
      <p>
        <a className="underline" href="mailto:isaqueportilho2014@gmail.com">
          isaqueportilho2014@gmail.com
        </a>
      </p>
    </>
  );
}
