import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" updated="11 septembre 2026">
      <h2>Éditeur</h2>
      <p>
        Candidatly est édité par [Nom ou raison sociale de l’éditeur], [forme juridique, capital,
        RCS ou SIRET], dont le siège est situé [adresse postale].
      </p>
      <p>Contact : [adresse email de contact].</p>
      <p>Directeur de la publication : [nom du directeur de la publication].</p>
      <h2>Hébergement</h2>
      <ul>
        <li>
          Application : Vercel Inc., vercel.com, [adresse et téléphone de l’hébergeur à compléter au
          déploiement].
        </li>
        <li>
          Base de données, fichiers et authentification : Supabase, supabase.com, données hébergées
          dans l’Union européenne (région de Paris).
        </li>
      </ul>
      <h2>Sources des données</h2>
      <ul>
        <li>
          Offres d’alternance : La bonne alternance, via l’API Alternance
          (api.apprentissage.beta.gouv.fr).
        </li>
        <li>
          Fiches employeur : Annuaire des Entreprises (DINUM), API Recherche d’entreprises, données
          INSEE et INPI, sous Licence Ouverte 2.0.
        </li>
        <li>
          Métiers : Répertoire opérationnel des métiers et des emplois (ROME), France Travail.
        </li>
        <li>Adresses : service de géocodage de la Géoplateforme (IGN).</li>
      </ul>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, l’interface et le code de Candidatly sont protégés. Les données publiques
        listées ci-dessus restent soumises à leurs licences respectives.
      </p>
    </LegalPage>
  );
}
