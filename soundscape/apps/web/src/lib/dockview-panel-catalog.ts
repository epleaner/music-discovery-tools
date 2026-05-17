export type DockviewPanelType =
  | 'library'
  | 'similar-artists'
  | 'newsletters'
  | 'sites'
  | 'websocket';

export interface DockviewPanelDefinition {
  id: DockviewPanelType;
  title: string;
}

export const soundscapeDockviewTabComponent = 'soundscape-tab';

export interface DockviewPanelDescriptor {
  id: string;
  component: DockviewPanelType;
  tabComponent: typeof soundscapeDockviewTabComponent;
  title: string;
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
  { id: 'sites', title: 'Sites' },
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

export function buildInitialDockviewPanels(): DockviewPanelDescriptor[] {
  return [
    {
      ...createDockviewPanelDescriptor('library', 1),
      initialWidth: 700,
    },
    {
      ...createDockviewPanelDescriptor('similar-artists', 1),
      position: { referencePanel: 'library-1', direction: 'right' },
      initialWidth: 300,
    },
    {
      ...createDockviewPanelDescriptor('sites', 1),
      position: { referencePanel: 'library-1', direction: 'below' },
      initialHeight: 300,
    },
  ];
}
