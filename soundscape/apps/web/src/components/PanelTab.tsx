import { createEffect, splitProps, type Component } from 'solid-js';
import type { ButtonProps } from './Button';

export interface PanelTabProps extends Omit<ButtonProps, 'variant'> {
  active?: boolean | (() => boolean);
  underline?: boolean;
}

const PanelTab: Component<PanelTabProps> = (props) => {
  const [local, rest] = splitProps(props, ['active', 'underline', 'class']);
  let buttonRef!: HTMLButtonElement;

  createEffect(() => {
    const active =
      typeof local.active === 'function'
        ? local.active()
        : (local.active ?? false);
    const classes = ['panel-tab'];
    if (local.underline) {
      classes.push('font-medium', 'border-b-2', 'transition-colors');
      classes.push(
        active
          ? 'border-accent'
          : 'border-transparent text-fg-muted hover:text-fg'
      );
    } else {
      classes.push(
        active ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg'
      );
    }
    if (local.class) classes.push(local.class);
    buttonRef.className = classes.join(' ');
  });

  return <button {...rest} ref={buttonRef} />;
};

export default PanelTab;
