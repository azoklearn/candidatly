import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Conditions d’utilisation" };

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d’utilisation" updated="11 septembre 2026">
      <h2>Objet</h2>
      <p>
        Candidatly aide les étudiants à trouver des offres d’alternance publiées, à préparer une
        lettre de motivation adaptée à chaque offre et à suivre leurs candidatures. Ces conditions
        s’appliquent à toute personne qui crée un compte.
      </p>
      <h2>Accès et prix</h2>
      <p>
        Le service nécessite un compte. Il est gratuit pendant la bêta. Toute formule payante future
        sera annoncée à l’avance et ne s’appliquera qu’avec votre accord.
      </p>
      <h2>Fonctionnement</h2>
      <ul>
        <li>
          Les offres sont publiées par des tiers. Candidatly ne garantit ni leur exactitude, ni leur
          disponibilité, ni la réponse des recruteurs.
        </li>
        <li>
          La lettre adaptée est une proposition construite à partir de votre lettre de base, de
          votre CV et de l’offre. Vous la relisez et restez responsable de ce que vous envoyez.
        </li>
        <li>Vous envoyez vous-même vos candidatures sur le site de chaque offre.</li>
      </ul>
      <h2>Vos engagements</h2>
      <ul>
        <li>Fournir des informations exactes et des documents dont vous êtes l’auteur.</li>
        <li>
          Ne pas utiliser le service de manière abusive ou automatisée, ni tenter d’accéder aux
          données d’autres utilisateurs.
        </li>
        <li>Garder vos identifiants confidentiels.</li>
      </ul>
      <h2>Responsabilité</h2>
      <p>
        Candidatly s’efforce d’assurer un service disponible et fiable, sans pouvoir le garantir en
        continu pendant la bêta. Candidatly ne peut être tenu responsable des décisions des
        recruteurs ni du contenu des sites tiers.
      </p>
      <h2>Suppression du compte</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis la page Compte. La suppression
        efface vos données et vos fichiers. En cas de manquement grave à ces conditions, un compte
        peut être suspendu.
      </p>
      <h2>Évolution et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer. Vous serez informé de tout changement important. Elles sont
        soumises au droit français. Contact : [adresse email de contact].
      </p>
    </LegalPage>
  );
}
