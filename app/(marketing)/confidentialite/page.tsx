import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="11 septembre 2026">
      <p>
        Cette page explique quelles données Candidatly traite, pourquoi, avec qui, combien de temps,
        et comment exercer vos droits.
      </p>
      <h2>Responsable du traitement</h2>
      <p>[Nom ou raison sociale de l’éditeur], joignable à [adresse email de contact].</p>
      <h2>Données traitées</h2>
      <ul>
        <li>
          Compte : adresse email et mot de passe, ou connexion Google. Les mots de passe sont gérés
          par notre fournisseur d’authentification et ne nous sont jamais lisibles.
        </li>
        <li>
          Profil : prénom, nom, téléphone facultatif, école, formation, niveau de diplôme, type de
          contrat, date de disponibilité.
        </li>
        <li>
          Recherche : métiers visés, ville ou adresse et coordonnées correspondantes, rayon de
          recherche.
        </li>
        <li>Documents : votre CV et votre lettre de motivation, fichiers et texte extrait.</li>
        <li>
          Candidatures : lettres adaptées, statuts, dates, notes et historique des changements de
          statut.
        </li>
        <li>Abonnement : forfait choisi, statut et dates de l’abonnement.</li>
        <li>
          Données techniques : journaux de fonctionnement, sans contenu de CV ni de lettre, et
          mesure d’audience anonyme (pages vues).
        </li>
      </ul>
      <h2>Finalités et bases légales</h2>
      <ul>
        <li>
          Fournir le service : recherche d’offres, fiches employeur, adaptation de la lettre, suivi
          des candidatures. Base légale : exécution du contrat.
        </li>
        <li>
          Assurer la sécurité et prévenir les abus, par exemple en limitant le nombre de demandes.
          Base légale : intérêt légitime.
        </li>
        <li>
          Mesurer l’audience du site de façon agrégée, pour l’améliorer. Base légale : intérêt
          légitime.
        </li>
      </ul>
      <p>
        Aucune donnée n’est vendue ni utilisée à des fins publicitaires. Aucun modèle d’intelligence
        artificielle ne traite vos documents à ce jour.
      </p>
      <h2>Destinataires et sous-traitants</h2>
      <ul>
        <li>
          Supabase : base de données, stockage des fichiers et authentification, hébergés dans
          l’Union européenne.
        </li>
        <li>Vercel : hébergement de l’application et mesure d’audience (Vercel Web Analytics).</li>
        <li>
          Whop : paiement des forfaits. Whop reçoit votre identifiant Candidatly et les informations
          de paiement que vous saisissez sur sa page, jamais vos documents.
        </li>
        <li>
          API Alternance : reçoit vos critères de recherche (métiers, zone, niveau), jamais votre
          identité.
        </li>
        <li>
          Géoplateforme (IGN) : reçoit l’adresse ou la ville que vous saisissez, pour la convertir
          en coordonnées.
        </li>
        <li>
          API Recherche d’entreprises : reçoit le numéro SIRET ou le nom de l’employeur d’une offre,
          jamais vos données.
        </li>
      </ul>
      <p>
        Vous envoyez vous-même vos candidatures sur le site de chaque offre : Candidatly ne transmet
        rien aux recruteurs.
      </p>
      <h2>Durées de conservation</h2>
      <ul>
        <li>
          Vos données sont conservées tant que votre compte existe, et effacées dès sa suppression,
          fichiers compris.
        </li>
        <li>Un document remplacé est supprimé immédiatement.</li>
        <li>
          Les fiches employeur, issues de données publiques, sont renouvelées tous les 30 jours.
        </li>
      </ul>
      <h2>Vos droits</h2>
      <p>
        Vous disposez des droits d’accès, de rectification, d’effacement, de limitation,
        d’opposition et de portabilité. Depuis la page Compte, vous pouvez modifier votre profil,
        télécharger toutes vos données et supprimer votre compte. Pour toute autre demande, écrivez
        à [adresse email de contact]. Vous pouvez aussi saisir la CNIL (cnil.fr).
      </p>
      <h2>Dirigeants d’entreprise</h2>
      <p>
        Les fiches employeur peuvent afficher le prénom, le nom et la fonction de dirigeants, issus
        du registre public de l’Annuaire des Entreprises. Aucune date de naissance n’est conservée.
        Un dirigeant peut s’opposer à cette publication auprès de l’Annuaire des Entreprises, puis
        nous écrire pour un retrait immédiat.
      </p>
      <h2>Cookies</h2>
      <p>
        Candidatly n’utilise que les cookies nécessaires à votre session de connexion. La mesure
        d’audience (Vercel Web Analytics) ne dépose aucun cookie : les visites sont comptées de
        façon agrégée, et nous retirons des adresses de pages les identifiants et les paramètres
        avant tout envoi. Aucun traceur publicitaire n’est utilisé.
      </p>
      <h2>Sécurité</h2>
      <p>
        Vos fichiers sont stockés dans un espace privé, accessible à vous seul. Les accès sont
        contrôlés et les données sont chiffrées au repos par notre hébergeur.
      </p>
    </LegalPage>
  );
}
