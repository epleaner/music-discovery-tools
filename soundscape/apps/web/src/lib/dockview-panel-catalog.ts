export type DockviewPanelType =
  | 'library'
  | 'similar-artists'
  | 'newsletters'
  | 'site'
  | 'genre-stats'
  | 'rym-charts'
  | 'websocket';

export interface DockviewPanelDefinition {
  id: DockviewPanelType;
  title: string;
}

export interface DockviewSiteDefinition {
  id: string;
  name: string;
}

export const soundscapeDockviewTabComponent = 'soundscape-tab';

export interface DockviewPanelDescriptor {
  id: string;
  component: DockviewPanelType;
  tabComponent: typeof soundscapeDockviewTabComponent;
  title: string;
  params?: Record<string, string>;
  position?: {
    referencePanel: string;
    direction: 'left' | 'right' | 'above' | 'below' | 'within';
  };
  initialWidth?: number;
  initialHeight?: number;
}

export const dockviewPanelTypes: DockviewPanelDefinition[] = [
  { id: 'library', title: 'Library' },
  { id: 'similar-artists', title: 'Similar Artists' },
  { id: 'newsletters', title: 'Newsletters' },
  { id: 'site', title: 'Site' },
  { id: 'genre-stats', title: 'Genre Stats' },
  { id: 'rym-charts', title: 'RYM Charts' },
  { id: 'websocket', title: 'WebSocket' },
];

const panelTitles = new Map(
  dockviewPanelTypes.map((panel) => [panel.id, panel.title])
);

export function createDockviewPanelDescriptor(
  panelType: DockviewPanelType,
  instanceNumber: number
): DockviewPanelDescriptor {
  return {
    id: `${panelType}-${instanceNumber}`,
    component: panelType,
    tabComponent: soundscapeDockviewTabComponent,
    title: panelTitles.get(panelType) ?? panelType,
  };
}

export function createSiteDockviewPanelDescriptor(
  site: DockviewSiteDefinition,
  instanceNumber: number
): DockviewPanelDescriptor {
  return {
    id: `site-${instanceNumber}`,
    component: 'site',
    tabComponent: soundscapeDockviewTabComponent,
    title: site.name,
    params: { siteId: site.id },
  };
}

export function buildInitialDockviewPanels(
  sites: DockviewSiteDefinition[] = []
): DockviewPanelDescriptor[] {
  const initialPanels: DockviewPanelDescriptor[] = [
    {
      ...createDockviewPanelDescriptor('library', 1),
      initialWidth: 700,
    },
    {
      ...createDockviewPanelDescriptor('similar-artists', 1),
      position: { referencePanel: 'library-1', direction: 'right' },
      initialWidth: 300,
    },
  ];

  sites.forEach((site, index) => {
    initialPanels.push({
      ...createSiteDockviewPanelDescriptor(site, index + 1),
      position: { referencePanel: 'library-1', direction: 'below' },
      initialHeight: 300,
    });
  });

  return initialPanels;
}
