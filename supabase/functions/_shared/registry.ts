type Establishment = {
  siret?: string;
  etat_administratif?: string;
  libelle_commune?: string;
  commune?: string;
  code_postal?: string;
  activite_principale?: string;
  date_creation?: string;
};

type RegistryCompany = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  etat_administratif?: string;
  activite_principale?: string;
  date_creation?: string;
  siege?: Establishment;
  matching_etablissements?: Establishment[];
};

export type RegistryMatch = {
  legalName: string;
  commune: string;
  postalCode: string;
  snapshot: Record<string, string>;
};

export async function lookupSiret(siret: string): Promise<RegistryMatch | null> {
  const url = new URL('https://recherche-entreprises.api.gouv.fr/search');
  url.searchParams.set('q', siret);
  url.searchParams.set('per_page', '1');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('registry_unavailable');

  const payload = await response.json() as { results?: RegistryCompany[] };
  const company = payload.results?.find((item) => item.siren === siret.slice(0, 9));
  const establishments = [
    ...(company?.matching_etablissements ?? []),
    ...(company?.siege ? [company.siege] : []),
  ];
  const exact = establishments.find((item) => item.siret === siret);
  const legalName = company?.nom_complet || company?.nom_raison_sociale;
  if (!company || company.etat_administratif !== 'A' || exact?.etat_administratif !== 'A' || !legalName) {
    return null;
  }
  const commune = exact.libelle_commune || exact.commune || '';
  const postalCode = exact.code_postal || '';
  return {
    legalName,
    commune,
    postalCode,
    snapshot: {
      siren: company.siren ?? '',
      siret,
      legal_name: legalName,
      company_status: company.etat_administratif ?? '',
      establishment_status: exact.etat_administratif ?? '',
      commune,
      postal_code: postalCode,
      activity_code: exact.activite_principale || company.activite_principale || '',
      created_at: exact.date_creation || company.date_creation || '',
      source: 'recherche-entreprises.api.gouv.fr',
    },
  };
}
