import type { Site } from '../components/SiteViewer';

export function createNewSite(sites: Site[]): Site {
  const nextId =
    Math.max(
      1,
      ...sites
        .map((site) => site.id.match(/^site-(\d+)$/)?.[1])
        .filter((id): id is string => Boolean(id))
        .map(Number)
    ) + 1;

  return {
    id: `site-${nextId}`,
    name: 'New Site',
    url: '',
  };
}

export function upsertSite(sites: Site[], site: Site): Site[] {
  const existingIndex = sites.findIndex(
    (currentSite) => currentSite.id === site.id
  );
  if (existingIndex === -1) {
    return [...sites, site];
  }

  const nextSites = [...sites];
  nextSites[existingIndex] = site;
  return nextSites;
}
