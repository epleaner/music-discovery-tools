import { splitProps, type Component } from 'solid-js';
import Button, { type ButtonProps } from './Button';

export interface PanelTabProps extends Omit<ButtonProps, 'variant'> {
  active?: boolean | (() => boolean);
  underline?: boolean;
}

const PanelTab: Component<PanelTabProps> = (props) => {
  const [local, rest] = splitProps(props, ['active', 'underline', 'class']);

  return (
    <Button
      {...rest}
      variant="tab"
      class={local.class}
      aria-pressed={
        typeof local.active === 'function'
          ? local.active()
          : (local.active ?? false)
      }
      data-tone={local.underline ? undefined : 'quiet'}
    />
  );
};

export default PanelTab;
