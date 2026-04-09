export interface AppLayoutModel {
  showMainLayout: boolean;
  showUsernamePrompt: boolean;
  showLibraryEmptyState: boolean;
}

export function buildAppLayoutModel(username: string): AppLayoutModel {
  const hasUsername = username.trim().length > 0;

  return {
    showMainLayout: true,
    showUsernamePrompt: false,
    showLibraryEmptyState: !hasUsername,
  };
}
