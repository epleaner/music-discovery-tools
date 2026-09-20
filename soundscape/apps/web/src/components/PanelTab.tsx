import { createMemo, splitProps, type Component } from 'solid-js';
import Button, { type ButtonProps } from './Button';

export interface PanelTabProps extends Omit<ButtonProps, 'variant'> {
  active?: boolean;
  underline?: boolean;
}

const PanelTab: Component<PanelTabProps> = (props) => {
  const [local, rest] = splitProps(props, ['active', 'underline', 'class']);
  const tabClass = createMemo(
    () =>
      `${
        local.underline
          ? `font-medium border-b-2 transition-colors ${
              local.active
                ? 'border-accent'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`
          : local.active
            ? 'bg-accent text-bg'
            : 'text-fg-muted hover:text-fg'
      } ${local.class ?? ''}`
  );

  return <Button {...rest} variant="tab" class={tabClass()} />;
};

export default PanelTab;
