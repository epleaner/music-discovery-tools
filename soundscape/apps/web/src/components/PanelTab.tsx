import { splitProps, type Component } from 'solid-js';
import type { ButtonProps } from './Button';

export interface PanelTabProps extends Omit<ButtonProps, 'variant'> {
  active?: boolean | (() => boolean);
  underline?: boolean;
}

const PanelTab: Component<PanelTabProps> = (props) => {
  const [local, rest] = splitProps(props, ['active', 'underline', 'class']);
  const isActive = () =>
    typeof local.active === 'function'
      ? local.active()
      : (local.active ?? false);

  return (
    <button
      {...rest}
      class={`panel-tab ${local.class ?? ''}`}
      classList={{
        'font-medium border-b-2 transition-colors': !!local.underline,
        'border-accent': !!local.underline && isActive(),
        'border-transparent text-fg-muted hover:text-fg':
          !!local.underline && !isActive(),
        'bg-accent text-bg': !local.underline && isActive(),
        'text-fg-muted hover:text-fg': !local.underline && !isActive(),
      }}
    />
  );
};

export default PanelTab;
